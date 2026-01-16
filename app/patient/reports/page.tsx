"use client"

import type React from "react"

import { useState, useRef } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FileText, Upload, Trash2, Download, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  // Handle both response formats: { success: true, data: [...] } or array directly
  if (data.success && data.data) {
    return data.data
  }
  if (Array.isArray(data)) {
    return data
  }
  return []
}

interface Report {
  id: string
  title: string
  description: string | null
  file_url: string
  file_name?: string
  file_type: string
  uploaded_at: string
  shared_with_doctor_id: string | null
  doctor_name: string | null
  specialization: string | null
}

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string
}

export default function PatientReportsPage() {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [selectedDoctor, setSelectedDoctor] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: reports = [], mutate: mutateReports } = useSWR<Report[]>("/api/medical-reports", fetcher)
  const { data: doctorsData } = useSWR<any>("/api/doctors", fetcher)
  
  // Handle doctors API response format
  const doctors: Doctor[] = doctorsData?.success && Array.isArray(doctorsData.data) 
    ? doctorsData.data 
    : Array.isArray(doctorsData) 
      ? doctorsData 
      : []

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large. Maximum size is 10MB.")
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !title) {
      toast.error("Please provide a title and select a file")
      return
    }

    setUploading(true)
    try {
      // Upload file to blob storage
      const formData = new FormData()
      formData.append("file", selectedFile)

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.error || "Upload failed")
      }

      const { url, type } = await uploadRes.json()

      // Create medical report record
      const reportRes = await fetch("/api/medical-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          fileUrl: url,
          fileType: type,
          sharedWithDoctorId: selectedDoctor || null,
        }),
      })

      if (!reportRes.ok) {
        throw new Error("Failed to save report")
      }

      toast.success("Report uploaded successfully")
      mutateReports()
      setOpen(false)
      setTitle("")
      setDescription("")
      setSelectedDoctor("")
      setSelectedFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/medical-reports/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Report deleted")
        mutateReports()
      } else {
        toast.error("Failed to delete report")
      }
    } catch {
      toast.error("Failed to delete report")
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return "PDF"
    if (type.includes("image")) return "IMG"
    return "DOC"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Medical Reports</h1>
          <p className="text-muted-foreground">Upload and manage your medical documents</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Medical Report</DialogTitle>
              <DialogDescription>Upload your medical documents to share with your doctors</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Report Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Blood Test Results"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any notes about this report..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctor">Share with Doctor (Optional)</Label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No doctors found</div>
                    ) : (
                      doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          Dr. {doctor.firstName} {doctor.lastName} - {doctor.specialization}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to select a file</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No reports yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload your medical reports to share them with your healthcare providers
            </p>
            <Button onClick={() => setOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Your First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                      {getFileIcon(report.file_type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{report.title}</CardTitle>
                      <CardDescription>{formatDate(report.uploaded_at)}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                    <a href={report.file_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1 bg-transparent">
                    <a href={report.file_url} download>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this medical report. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(report.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
