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

    let prescriptions: any[] = []

    if (user.role === "patient") {
      prescriptions = await sql`
        SELECT 
          p.id,
          p.diagnosis,
          p.notes,
          p.valid_until,
          p.created_at,
          CONCAT(du.first_name, ' ', du.last_name) as doctor_name,
          dp.specialization,
          (
            SELECT json_agg(
              json_build_object(
                'name', pi.medication_name,
                'dosage', pi.dosage,
                'frequency', pi.frequency,
                'duration', pi.duration
              )
            )
            FROM prescription_items pi
            WHERE pi.prescription_id = p.id
          ) as medications
        FROM prescriptions p
        JOIN users du ON p.doctor_id = du.id
        LEFT JOIN doctor_profiles dp ON p.doctor_id = dp.user_id
        WHERE p.patient_id = ${user.id}
        ORDER BY p.created_at DESC
      `
    } else if (user.role === "doctor") {
      if (patientId) {
        // Get prescriptions for specific patient
        prescriptions = await sql`
          SELECT 
            p.id,
            p.diagnosis,
            p.notes,
            p.valid_until,
            p.created_at,
            CONCAT(pu.first_name, ' ', pu.last_name) as patient_name,
            (
              SELECT json_agg(
                json_build_object(
                  'name', pi.medication_name,
                  'dosage', pi.dosage,
                  'frequency', pi.frequency,
                  'duration', pi.duration
                )
              )
              FROM prescription_items pi
              WHERE pi.prescription_id = p.id
            ) as medications
          FROM prescriptions p
          JOIN users pu ON p.patient_id = pu.id
          WHERE p.doctor_id = ${user.id}
          AND p.patient_id = ${patientId}
          ORDER BY p.created_at DESC
        `
      } else {
        // Get all prescriptions by this doctor
        prescriptions = await sql`
          SELECT 
            p.id,
            p.diagnosis,
            p.notes,
            p.valid_until,
            p.created_at,
            CONCAT(pu.first_name, ' ', pu.last_name) as patient_name,
            (
              SELECT json_agg(
                json_build_object(
                  'name', pi.medication_name,
                  'dosage', pi.dosage,
                  'frequency', pi.frequency,
                  'duration', pi.duration
                )
              )
              FROM prescription_items pi
              WHERE pi.prescription_id = p.id
            ) as medications
          FROM prescriptions p
          JOIN users pu ON p.patient_id = pu.id
          WHERE p.doctor_id = ${user.id}
          ORDER BY p.created_at DESC
        `
      }
    } else {
      return NextResponse.json({ error: "Invalid role" }, { status: 403 })
    }

    // Ensure medications is always an array
    const formattedPrescriptions = prescriptions.map((p) => ({
      ...p,
      medications: p.medications || [],
    }))

    return NextResponse.json(formattedPrescriptions)
  } catch (error) {
    console.error("Get prescriptions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "doctor") {
      return NextResponse.json({ error: "Only doctors can create prescriptions" }, { status: 403 })
    }

    const body = await request.json()
    const { patientId, medications, diagnosis, notes, validUntil, appointmentId } = body

    if (!patientId || !diagnosis || !medications || !Array.isArray(medications) || medications.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate medications
    for (const med of medications) {
      if (!med.name || !med.dosage) {
        return NextResponse.json({ error: "All medications must have name and dosage" }, { status: 400 })
      }
    }

    // Create prescription
    const prescription = await sql`
      INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, notes, valid_until)
      VALUES (${patientId}, ${user.id}, ${appointmentId || null}, ${diagnosis}, ${notes || null}, ${validUntil || null})
      RETURNING id, diagnosis, notes, valid_until, created_at
    `

    if (!prescription || prescription.length === 0) {
      return NextResponse.json({ error: "Failed to create prescription" }, { status: 500 })
    }

    const prescriptionId = prescription[0].id

    // Insert prescription items (medications)
    for (const med of medications) {
      await sql`
        INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions)
        VALUES (${prescriptionId}, ${med.name}, ${med.dosage || null}, ${med.frequency || null}, ${med.duration || null}, ${med.instructions || null})
      `
    }

    // Create notification for patient
    try {
      await sql`
        INSERT INTO notifications (user_id, title, message, type, action_url)
        VALUES (${patientId}, 'New Prescription', ${`Dr. ${user.firstName} ${user.lastName} has issued a new prescription for you`}, 'prescription', '/patient/prescriptions')
      `
    } catch (notifError) {
      // Don't fail prescription creation if notification fails
      console.error("Notification creation error:", notifError)
    }

    return NextResponse.json({
      ...prescription[0],
      medications: medications,
    })
  } catch (error) {
    console.error("Create prescription error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, { status: 500 })
  }
}
