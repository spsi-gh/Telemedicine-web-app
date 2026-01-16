import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Fetching patients for doctor:", user.id)

    // Get patients who have booked appointments with this doctor
    // Include all appointment statuses except cancelled
    const patients = await sql`
      SELECT DISTINCT ON (u.id)
        u.id,
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        pp.date_of_birth,
        pp.blood_type
      FROM users u
      JOIN appointments a ON a.patient_id = u.id
      LEFT JOIN patient_profiles pp ON u.id = pp.user_id
      WHERE a.doctor_id = ${user.id}
        AND u.role = 'patient'
        AND a.status != 'cancelled'
      ORDER BY u.id, a.scheduled_at DESC
    `

    console.log(`Found ${patients?.length || 0} patients for doctor ${user.id}`)
    
    // Ensure we return an array
    const result = Array.isArray(patients) ? patients : []
    return NextResponse.json(result)
  } catch (error) {
    console.error("Get patients error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
