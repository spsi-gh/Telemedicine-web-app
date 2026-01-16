import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get existing conversations
    const conversations = await sql`
      SELECT 
        c.id,
        c.created_at,
        c.last_message_at as "updated_at",
        CASE 
          WHEN c.patient_id = ${user.id} THEN c.doctor_id
          ELSE c.patient_id
        END as other_user_id,
        CASE 
          WHEN c.patient_id = ${user.id} THEN CONCAT(du.first_name, ' ', du.last_name)
          ELSE CONCAT(pu.first_name, ' ', pu.last_name)
        END as other_user_name,
        CASE 
          WHEN c.patient_id = ${user.id} THEN 'doctor'
          ELSE 'patient'
        END as other_user_role,
        dp.specialization,
        (
          SELECT content FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) as last_message,
        (
          SELECT created_at FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC LIMIT 1
        ) as last_message_at,
        (
          SELECT COUNT(*) FROM messages 
          WHERE conversation_id = c.id 
          AND sender_id != ${user.id}
          AND is_read = false
        )::int as unread_count
      FROM conversations c
      LEFT JOIN users pu ON c.patient_id = pu.id
      LEFT JOIN users du ON c.doctor_id = du.id
      LEFT JOIN doctor_profiles dp ON c.doctor_id = dp.user_id
      WHERE c.patient_id = ${user.id} OR c.doctor_id = ${user.id}
      ORDER BY c.last_message_at DESC
    `

    // Get doctors/patients from appointments that don't have conversations yet
    let appointmentContacts: any[] = []
    
    if (user.role === "patient") {
      // Get doctors from appointments
      const appointmentDoctors = await sql`
        SELECT DISTINCT ON (a.doctor_id)
          a.doctor_id as other_user_id,
          CONCAT(u.first_name, ' ', u.last_name) as other_user_name,
          'doctor' as other_user_role,
          dp.specialization,
          NULL::uuid as id,
          NULL::timestamp as created_at,
          NULL::timestamp as updated_at,
          NULL::text as last_message,
          NULL::timestamp as last_message_at,
          0::int as unread_count
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        LEFT JOIN doctor_profiles dp ON a.doctor_id = dp.user_id
        WHERE a.patient_id = ${user.id}
          AND a.status != 'cancelled'
          AND NOT EXISTS (
            SELECT 1 FROM conversations c 
            WHERE c.patient_id = ${user.id} 
            AND c.doctor_id = a.doctor_id
          )
        ORDER BY a.doctor_id, a.scheduled_at DESC
      `
      appointmentContacts = appointmentDoctors
    } else if (user.role === "doctor") {
      // Get patients from appointments
      const appointmentPatients = await sql`
        SELECT DISTINCT ON (a.patient_id)
          a.patient_id as other_user_id,
          CONCAT(u.first_name, ' ', u.last_name) as other_user_name,
          'patient' as other_user_role,
          NULL::text as specialization,
          NULL::uuid as id,
          NULL::timestamp as created_at,
          NULL::timestamp as updated_at,
          NULL::text as last_message,
          NULL::timestamp as last_message_at,
          0::int as unread_count
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        WHERE a.doctor_id = ${user.id}
          AND a.status != 'cancelled'
          AND NOT EXISTS (
            SELECT 1 FROM conversations c 
            WHERE c.doctor_id = ${user.id} 
            AND c.patient_id = a.patient_id
          )
        ORDER BY a.patient_id, a.scheduled_at DESC
      `
      appointmentContacts = appointmentPatients
    }

    // Combine conversations and appointment contacts
    const allContacts = [...conversations, ...appointmentContacts]

    return NextResponse.json(allContacts)
  } catch (error) {
    console.error("Get conversations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { doctorId, patientId } = body || {}

    // The schema uses user IDs directly, not profile IDs
    let patientUserId: string
    let doctorUserId: string

    if (user.role === "patient") {
      patientUserId = user.id
      doctorUserId = doctorId
      if (!doctorId || typeof doctorId !== "string") {
        console.error("Invalid doctorId:", doctorId)
        return NextResponse.json({ error: "Doctor ID is required and must be a valid UUID" }, { status: 400 })
      }
    } else if (user.role === "doctor") {
      doctorUserId = user.id
      patientUserId = patientId
      if (!patientId || typeof patientId !== "string") {
        console.error("Invalid patientId:", patientId)
        return NextResponse.json({ error: "Patient ID is required and must be a valid UUID" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Invalid user role" }, { status: 403 })
    }

    if (!patientUserId || !doctorUserId || typeof patientUserId !== "string" || typeof doctorUserId !== "string") {
      console.error("Missing or invalid user IDs:", { patientUserId, doctorUserId })
      return NextResponse.json({ error: "Missing or invalid user IDs" }, { status: 400 })
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(patientUserId) || !uuidRegex.test(doctorUserId)) {
      console.error("Invalid UUID format:", { patientUserId, doctorUserId })
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
    }

    // Verify the other user exists
    const otherUserId = user.role === "patient" ? doctorUserId : patientUserId
    const otherUser = await sql`
      SELECT id, role FROM users WHERE id = ${otherUserId}
    `
    
    if (!otherUser || !Array.isArray(otherUser) || otherUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const otherUserRole = otherUser[0]?.role
    if (!otherUserRole) {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 })
    }
    if (user.role === "patient" && otherUserRole !== "doctor") {
      return NextResponse.json({ error: "Invalid doctor ID" }, { status: 400 })
    }
    if (user.role === "doctor" && otherUserRole !== "patient") {
      return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 })
    }

    // Check if conversation exists
    const existing = await sql`
      SELECT id FROM conversations 
      WHERE patient_id = ${patientUserId} AND doctor_id = ${doctorUserId}
    `

    if (existing && Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json(existing[0])
    }

    // Create new conversation
    const conversation = await sql`
      INSERT INTO conversations (patient_id, doctor_id)
      VALUES (${patientUserId}, ${doctorUserId})
      RETURNING id, created_at, last_message_at
    `

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      console.error("Conversation creation failed - no result returned")
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    const newConversation = conversation[0]
    if (!newConversation || !newConversation.id) {
      console.error("Conversation creation failed - invalid result:", newConversation)
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    return NextResponse.json(newConversation)
  } catch (error) {
    console.error("Create conversation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("Error stack:", errorStack)
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
    })
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? errorStack : undefined
    }, { status: 500 })
  }
}
