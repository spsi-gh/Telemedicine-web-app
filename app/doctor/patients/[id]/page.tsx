import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, FileText, Pill, MessageSquare, Phone, Mail, AlertCircle, ArrowLeft, Eye, Download } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

async function getPatientDetails(patientId: string, doctorId: string) {
  // Verify doctor has treated this patient
  const [relationship] = await sql`
    SELECT COUNT(*) as count FROM appointments 
    WHERE patient_id = ${patientId} AND doctor_id = ${doctorId}
  `

  if (Number(relationship.count) === 0) {
    return null
  }

  const [patient] = await sql`
    SELECT 
      u.id, u.first_name as "firstName", u.last_name as "lastName", 
      u.email, u.phone, u.avatar_url as "avatarUrl",
      pp.date_of_birth as "dateOfBirth", pp.gender, pp.blood_type as "bloodType",
      pp.allergies, pp.chronic_conditions as "chronicConditions"
    FROM users u
    LEFT JOIN patient_profiles pp ON u.id = pp.user_id
    WHERE u.id = ${patientId}
  `

  return patient
}

async function getPatientAppointments(patientId: string, doctorId: string) {
  return sql`
    SELECT id, scheduled_at as "scheduledAt", status, type, symptoms, notes
    FROM appointments
    WHERE patient_id = ${patientId} AND doctor_id = ${doctorId}
    ORDER BY scheduled_at DESC
    LIMIT 10
  `
}

async function getPatientReports(patientId: string) {
  return sql`
    SELECT 
      id, 
      title, 
      description,
      report_type as "reportType", 
      file_url as "fileUrl", 
      file_name as "fileName",
      report_date as "reportDate",
      created_at as "createdAt"
    FROM medical_reports
    WHERE patient_id = ${patientId} AND is_shared_with_doctors = true
    ORDER BY report_date DESC, created_at DESC
    LIMIT 10
  `
}

async function getPatientPrescriptions(patientId: string, doctorId: string) {
  return sql`
    SELECT id, diagnosis, created_at as "createdAt", is_active as "isActive"
    FROM prescriptions
    WHERE patient_id = ${patientId} AND doctor_id = ${doctorId}
    ORDER BY created_at DESC
    LIMIT 10
  `
}

export default async function PatientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return null

  const { id } = await params
  const patient = await getPatientDetails(id, user.id)

  if (!patient) {
    notFound()
  }

  const appointments = await getPatientAppointments(id, user.id)
  const reports = await getPatientReports(id)
  const prescriptions = await getPatientPrescriptions(id, user.id)

  const initials = `${patient.firstName[0]}${patient.lastName[0]}`.toUpperCase()
  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <div className="min-h-screen">
      <DashboardHeader title="Patient Details" subtitle="View patient information and history" />

      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link href="/doctor/patients">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Patients
          </Button>
        </Link>

        {/* Patient Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={patient.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">
                    {patient.firstName} {patient.lastName}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {age && <span>{age} years old</span>}
                    {patient.gender && <span className="capitalize">{patient.gender}</span>}
                    {patient.bloodType && <Badge variant="outline">{patient.bloodType}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {patient.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {patient.email}
                  </div>
                )}
                {patient.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {patient.phone}
                  </div>
                )}
              </div>
            </div>

            {/* Medical Alerts */}
            {(patient.allergies?.length > 0 || patient.chronicConditions?.length > 0) && (
              <div className="mt-6 pt-6 border-t space-y-4">
                {patient.allergies?.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">Allergies</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {patient.allergies.map((allergy: string, i: number) => (
                          <Badge key={i} variant="destructive" className="bg-destructive/10 text-destructive">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {patient.chronicConditions?.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                    <div>
                      <p className="font-medium">Chronic Conditions</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {patient.chronicConditions.map((condition: string, i: number) => (
                          <Badge key={i} variant="secondary">
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="appointments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="appointments" className="gap-2">
              <Calendar className="h-4 w-4" />
              Appointments
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="gap-2">
              <Pill className="h-4 w-4" />
              Prescriptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <Card>
              <CardHeader>
                <CardTitle>Appointment History</CardTitle>
                <CardDescription>Past consultations with this patient</CardDescription>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No appointments found</p>
                ) : (
                  <div className="space-y-4">
                    {appointments.map((apt: Record<string, unknown>) => (
                      <div key={apt.id as string} className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">{format(new Date(apt.scheduledAt as string), "MMMM d, yyyy")}</p>
                          <p className="text-sm text-muted-foreground">{apt.type as string}</p>
                          {apt.symptoms && (
                            <p className="text-sm text-muted-foreground mt-1">Symptoms: {apt.symptoms as string}</p>
                          )}
                        </div>
                        <Badge variant={(apt.status as string) === "completed" ? "default" : "secondary"}>
                          {apt.status as string}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Medical Reports</CardTitle>
                <CardDescription>Reports shared by the patient</CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No reports shared</p>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report: Record<string, unknown>) => (
                      <div
                        key={report.id as string}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{report.title as string}</p>
                            {report.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {report.description as string}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date((report.reportDate || report.createdAt) as string), "MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="capitalize">
                            {String(report.reportType || "other").replace("_", " ")}
                          </Badge>
                          {report.fileUrl && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="gap-1"
                              >
                                <a
                                  href={report.fileUrl as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    // If it's a local URL, ensure it opens correctly
                                    const url = report.fileUrl as string
                                    if (url.startsWith("/uploads/")) {
                                      e.preventDefault()
                                      window.open(url, "_blank")
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="gap-1"
                              >
                                <a
                                  href={report.fileUrl as string}
                                  download={report.fileName as string || report.title as string}
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prescriptions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prescriptions</CardTitle>
                  <CardDescription>Prescriptions you&apos;ve issued</CardDescription>
                </div>
                <Link href={`/doctor/prescriptions/new?patient=${id}`}>
                  <Button>Write Prescription</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {prescriptions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No prescriptions issued</p>
                ) : (
                  <div className="space-y-4">
                    {prescriptions.map((rx: Record<string, unknown>) => (
                      <div key={rx.id as string} className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium">{rx.diagnosis as string}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(rx.createdAt as string), "MMMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant={(rx.isActive as boolean) ? "default" : "secondary"}>
                          {(rx.isActive as boolean) ? "Active" : "Expired"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
