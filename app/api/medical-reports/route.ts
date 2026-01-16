import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get("patientId")

    let reports: any[] = []

    if (user.role === "patient") {
      // Patient can only see their own reports
      reports = await sql`
        SELECT 
          mr.id,
          mr.title,
          mr.description,
          mr.file_url as file_url,
          mr.file_name as file_name,
          mr.file_size as file_size,
          mr.report_date as report_date,
          mr.created_at as uploaded_at,
          mr.report_type as file_type,
          CASE 
            WHEN mr.is_shared_with_doctors = true THEN 'shared'
            ELSE NULL
          END as shared_with_doctor_id,
          CONCAT(u.first_name, ' ', u.last_name) as doctor_name,
          dp.specialization
        FROM medical_reports mr
        LEFT JOIN doctor_profiles dp ON mr.uploaded_by = dp.user_id
        LEFT JOIN users u ON dp.user_id = u.id
        WHERE mr.patient_id = ${user.id}
        ORDER BY mr.created_at DESC
      `
    } else if (user.role === "doctor" && patientId) {
      // Doctor can see reports shared with them (is_shared_with_doctors = true)
      reports = await sql`
        SELECT 
          mr.id,
          mr.title,
          mr.description,
          mr.file_url as file_url,
          mr.file_name as file_name,
          mr.file_size as file_size,
          mr.report_date as report_date,
          mr.created_at as uploaded_at,
          mr.report_type as file_type,
          CONCAT(pu.first_name, ' ', pu.last_name) as patient_name
        FROM medical_reports mr
        JOIN users pu ON mr.patient_id = pu.id
        WHERE mr.patient_id = ${patientId}
        AND mr.is_shared_with_doctors = true
        ORDER BY mr.created_at DESC
      `
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    return NextResponse.json(reports || [])
  } catch (error) {
    console.error("Get reports error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Only patients can upload reports" }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, fileUrl, fileType, sharedWithDoctorId } = body

    if (!title || !fileUrl) {
      return NextResponse.json({ error: "Title and file URL are required" }, { status: 400 })
    }

    // Extract file name and size from URL if possible, or use defaults
    const fileName = fileUrl.split("/").pop() || "report"
    const fileSize = 0 // We don't have this from the upload response currently

    // Determine report type from file type
    let reportType = "other"
    if (fileType?.includes("pdf")) {
      reportType = "lab_report"
    } else if (fileType?.includes("image")) {
      reportType = "imaging"
    }

    // Insert medical report - schema uses patient_id (user ID), not profile ID
    const report = await sql`
      INSERT INTO medical_reports (
        patient_id, 
        uploaded_by,
        title, 
        description, 
        file_url, 
        file_name,
        file_size,
        report_type,
        is_shared_with_doctors
      )
      VALUES (
        ${user.id}, 
        ${user.id},
        ${title}, 
        ${description || null}, 
        ${fileUrl}, 
        ${fileName},
        ${fileSize},
        ${reportType}::report_type,
        ${sharedWithDoctorId ? true : true}
      )
      RETURNING id, title, description, file_url, file_name, file_size, report_type, created_at
    `

    if (!report || report.length === 0) {
      return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
    }

    // Create notification for doctor if shared
    if (sharedWithDoctorId) {
      try {
        // sharedWithDoctorId should be a user ID, not profile ID
        await sql`
          INSERT INTO notifications (user_id, title, message, type, action_url)
          VALUES (
            ${sharedWithDoctorId}, 
            'New Medical Report Shared', 
            ${`${user.firstName} ${user.lastName} shared a medical report: ${title}`}, 
            'report', 
            '/doctor/patients/${user.id}'
          )
        `
      } catch (notifError) {
        // Don't fail report creation if notification fails
        console.error("Notification creation error:", notifError)
      }
    }

    return NextResponse.json({
      ...report[0],
      uploaded_at: report[0].created_at,
      file_type: report[0].report_type,
    })
  } catch (error) {
    console.error("Create report error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 })
  }
}
