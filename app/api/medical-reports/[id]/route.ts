import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"
import { del } from "@vercel/blob"

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get report and verify ownership
    // Schema uses patient_id as user ID directly
    const report = await sql`
      SELECT mr.*
      FROM medical_reports mr
      WHERE mr.id = ${id}
    `

    if (!report || report.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    // Verify ownership - only patient who uploaded can delete
    if (user.role !== "patient" || report[0].patient_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    // Delete from Vercel Blob
    if (report[0].file_url) {
      try {
        await del(report[0].file_url)
      } catch (e) {
        console.error("Failed to delete blob:", e)
      }
    }

    // Delete from database
    await sql`DELETE FROM medical_reports WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
