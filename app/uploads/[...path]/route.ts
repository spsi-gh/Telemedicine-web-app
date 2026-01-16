import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathArray } = await params
    const filePath = pathArray.join("/")
    
    // Security: prevent directory traversal
    if (filePath.includes("..")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    // Construct full file path
    const fullPath = join(process.cwd(), "uploads", filePath)
    
    // Check if file exists
    if (!existsSync(fullPath)) {
      console.error("File not found at path:", fullPath)
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Read file
    const fileBuffer = await readFile(fullPath)
    
    // Determine content type based on file extension
    const ext = filePath.split(".").pop()?.toLowerCase()
    const contentType = getContentType(ext || "")
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filePath.split("/").pop()}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }
  return types[ext] || "application/octet-stream"
}
