import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

async function saveFileLocally(file: File, userId: string): Promise<string> {
  const uploadsDir = join(process.cwd(), "uploads")
  
  // Create uploads directory if it doesn't exist
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  const fileName = `${Date.now()}-${file.name}`
  const filePath = join(uploadsDir, fileName)
  
  // Convert File to Buffer and save
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await writeFile(filePath, buffer)

  // Return URL that will be served by our route handler
  return `/uploads/${fileName}`
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type for medical reports
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only PDF and images are allowed." }, { status: 400 })
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    let fileUrl: string
    let fileType = file.type

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        // Upload to Vercel Blob with user-specific path
        const blob = await put(`medical-reports/${user.id}/${Date.now()}-${file.name}`, file, {
          access: "public",
        })

        if (!blob || !blob.url) {
          throw new Error("Blob upload failed - no URL returned")
        }

        console.log("File uploaded successfully to Vercel Blob:", blob.url)
        fileUrl = blob.url
      } catch (blobError) {
        console.error("Vercel Blob upload failed, falling back to local storage:", blobError)
        // Fallback to local storage if Blob fails
        fileUrl = await saveFileLocally(file, user.id)
      }
    } else {
      console.warn("BLOB_READ_WRITE_TOKEN not configured, using local storage")
      // Fallback to local storage
      fileUrl = await saveFileLocally(file, user.id)
    }

    return NextResponse.json({
      url: fileUrl,
      filename: file.name,
      size: file.size,
      type: fileType,
    })
  } catch (error) {
    console.error("Upload error:", error)
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? String(error) : undefined
    }, { status: 500 })
  }
}
