import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let appointments: any[] = []

    if (user.role === "patient") {
      if (status) {
        appointments = await sql`
          SELECT 
            a.id, a.scheduled_at as "scheduledAt", a.duration_minutes as "durationMinutes",
            a.status, a.type, a.symptoms, a.notes, a.meeting_link as "meetingLink",
            u.id as "doctorId", u.first_name as "doctorFirstName", u.last_name as "doctorLastName",
            u.avatar_url as "doctorAvatar",
            dp.specialization, dp.consultation_fee as "consultationFee"
          FROM appointments a
          JOIN users u ON a.doctor_id = u.id
          LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
          WHERE a.patient_id = ${user.id}
            AND a.status = ${status}
          ORDER BY a.scheduled_at DESC
        `
      } else {
        appointments = await sql`
          SELECT 
            a.id, a.scheduled_at as "scheduledAt", a.duration_minutes as "durationMinutes",
            a.status, a.type, a.symptoms, a.notes, a.meeting_link as "meetingLink",
            u.id as "doctorId", u.first_name as "doctorFirstName", u.last_name as "doctorLastName",
            u.avatar_url as "doctorAvatar",
            dp.specialization, dp.consultation_fee as "consultationFee"
          FROM appointments a
          JOIN users u ON a.doctor_id = u.id
          LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
          WHERE a.patient_id = ${user.id}
          ORDER BY a.scheduled_at DESC
        `
      }
    } else if (user.role === "doctor") {
      if (status) {
        appointments = await sql`
          SELECT 
            a.id, a.scheduled_at as "scheduledAt", a.duration_minutes as "durationMinutes",
            a.status, a.type, a.symptoms, a.notes, a.meeting_link as "meetingLink",
            u.id as "patientId", u.first_name as "patientFirstName", u.last_name as "patientLastName",
            u.avatar_url as "patientAvatar"
          FROM appointments a
          JOIN users u ON a.patient_id = u.id
          WHERE a.doctor_id = ${user.id}
            AND a.status = ${status}
          ORDER BY a.scheduled_at DESC
        `
      } else {
        appointments = await sql`
          SELECT 
            a.id, a.scheduled_at as "scheduledAt", a.duration_minutes as "durationMinutes",
            a.status, a.type, a.symptoms, a.notes, a.meeting_link as "meetingLink",
            u.id as "patientId", u.first_name as "patientFirstName", u.last_name as "patientLastName",
            u.avatar_url as "patientAvatar"
          FROM appointments a
          JOIN users u ON a.patient_id = u.id
          WHERE a.doctor_id = ${user.id}
          ORDER BY a.scheduled_at DESC
        `
      }
    } else {
      // Admin view
      appointments = await sql`
        SELECT 
          a.id, a.scheduled_at as "scheduledAt", a.duration_minutes as "durationMinutes",
          a.status, a.type, a.symptoms, a.notes, a.meeting_link as "meetingLink",
          p.id as "patientId", p.first_name as "patientFirstName", p.last_name as "patientLastName",
          d.id as "doctorId", d.first_name as "doctorFirstName", d.last_name as "doctorLastName"
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        ${status ? sql`WHERE a.status = ${status}` : sql``}
        ORDER BY a.scheduled_at DESC
      `
    }

    return NextResponse.json({
      success: true,
      data: appointments || [],
    })
  } catch (error) {
    console.error("Error fetching appointments:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch appointments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "patient") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { doctorId, scheduledAt, type, symptoms } = body

    if (!doctorId || !scheduledAt) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Check if time slot is available
    const existing = await sql`
      SELECT id FROM appointments 
      WHERE doctor_id = ${doctorId} 
      AND scheduled_at = ${scheduledAt}
      AND status != 'cancelled'
    `

    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "Time slot is not available" }, { status: 400 })
    }

    const [appointment] = await sql`
      INSERT INTO appointments (patient_id, doctor_id, scheduled_at, type, symptoms)
      VALUES (${user.id}, ${doctorId}, ${scheduledAt}, ${type || "consultation"}, ${symptoms || null})
      RETURNING id, scheduled_at as "scheduledAt", status, type
    `

    // Create notification for doctor
    await sql`
      INSERT INTO notifications (user_id, title, message, type, action_url)
      VALUES (
        ${doctorId},
        'New Appointment Request',
        ${`${user.firstName} ${user.lastName} has requested an appointment`},
        'appointment',
        '/doctor/appointments'
      )
    `

    return NextResponse.json({
      success: true,
      data: appointment,
      message: "Appointment booked successfully",
    })
  } catch (error) {
    console.error("Error creating appointment:", error)
    return NextResponse.json({ success: false, error: "Failed to create appointment" }, { status: 500 })
  }
}
