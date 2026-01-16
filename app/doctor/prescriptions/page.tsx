"use client"

import { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Plus, Pill, Calendar, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`API error for ${url}:`, res.status, res.statusText)
      return []
    }
    const data = await res.json()
    // Handle both array and error object responses
    if (Array.isArray(data)) {
      console.log(`Fetched ${data.length} items from ${url}`)
      return data
    }
    if (data.error) {
      console.error("API error:", data.error)
      return []
    }
    // If data is wrapped in a success/data structure
    if (data.success && Array.isArray(data.data)) {
      return data.data
    }
    console.warn(`Unexpected data format from ${url}:`, data)
    return []
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error)
    return []
  }
}

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
}

interface Prescription {
  id: string
  medications: Medication[] | null
  diagnosis: string
  notes: string | null
  valid_until: string | null
  created_at: string
  patient_name: string
}

interface Patient {
  id: string
  user_id: string
  name: string
  email?: string
}

export default function DoctorPrescriptionsPage() {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [notes, setNotes] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [medications, setMedications] = useState<Medication[]>([{ name: "", dosage: "", frequency: "", duration: "" }])

  const { data: prescriptionsData, mutate: mutatePrescriptions } = useSWR<any>(
    "/api/prescriptions",
    fetcher,
  )
  const { data: patientsData, error: patientsError } = useSWR<Patient[]>(
    "/api/doctor/patients",
    fetcher,
  )

  // Ensure patients is always an array
  const patients: Patient[] = Array.isArray(patientsData) ? patientsData : []
  
  // Log for debugging
  if (patientsError) {
    console.error("Error fetching patients:", patientsError)
  }
  if (patients.length === 0 && patientsData !== undefined) {
    console.warn("No patients found. Patients data:", patientsData)
  }

  // Ensure prescriptions is always an array
  const prescriptions: Prescription[] = Array.isArray(prescriptionsData) ? prescriptionsData : []

  const addMedication = () => {
    setMedications([...medications, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications]
    updated[index][field] = value
    setMedications(updated)
  }

  const handleCreate = async () => {
    if (!selectedPatient || !diagnosis || medications.some((m) => !m.name || !m.dosage)) {
      toast.error("Please fill in all required fields")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient,
          medications,
          diagnosis,
          notes: notes || null,
          validUntil: validUntil || null,
        }),
      })

      if (!res.ok) throw new Error("Failed to create prescription")

      toast.success("Prescription created successfully")
      mutatePrescriptions()
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to create prescription")
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setSelectedPatient("")
    setDiagnosis("")
    setNotes("")
    setValidUntil("")
    setMedications([{ name: "", dosage: "", frequency: "", duration: "" }])
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false
    return new Date(validUntil) < new Date()
  }

  const activePrescriptions = Array.isArray(prescriptions) 
    ? prescriptions.filter((p) => !isExpired(p.valid_until))
    : []
  const expiredPrescriptions = Array.isArray(prescriptions)
    ? prescriptions.filter((p) => isExpired(p.valid_until))
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <p className="text-muted-foreground">Create and manage patient prescriptions</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Prescription
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Prescription</DialogTitle>
              <DialogDescription>Write a new prescription for your patient</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsError ? (
                        <div className="p-2 text-sm text-destructive">Error loading patients</div>
                      ) : patients.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No patients found. Patients with appointments will appear here.
                        </div>
                      ) : (
                        patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valid Until (Optional)</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Diagnosis</Label>
                <Input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g., Upper respiratory infection"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Medications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Medication
                  </Button>
                </div>

                {medications.map((med, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Medication Name</Label>
                          <Input
                            value={med.name}
                            onChange={(e) => updateMedication(index, "name", e.target.value)}
                            placeholder="e.g., Amoxicillin"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dosage</Label>
                          <Input
                            value={med.dosage}
                            onChange={(e) => updateMedication(index, "dosage", e.target.value)}
                            placeholder="e.g., 500mg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Input
                            value={med.frequency}
                            onChange={(e) => updateMedication(index, "frequency", e.target.value)}
                            placeholder="e.g., 3 times daily"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Input
                            value={med.duration}
                            onChange={(e) => updateMedication(index, "duration", e.target.value)}
                            placeholder="e.g., 7 days"
                          />
                        </div>
                      </div>
                      {medications.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-destructive"
                          onClick={() => removeMedication(index)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions or notes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Prescription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activePrescriptions.length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({expiredPrescriptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {activePrescriptions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No active prescriptions</h3>
                <p className="text-muted-foreground text-center">Create a new prescription for your patients</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activePrescriptions.map((prescription) => (
                <PrescriptionCard key={prescription.id} prescription={prescription} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="mt-6">
          {expiredPrescriptions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No expired prescriptions</h3>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {expiredPrescriptions.map((prescription) => (
                <PrescriptionCard key={prescription.id} prescription={prescription} expired />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PrescriptionCard({ prescription, expired }: { prescription: Prescription; expired?: boolean }) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <Card className={expired ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{prescription.patient_name}</CardTitle>
            <CardDescription>{formatDate(prescription.created_at)}</CardDescription>
          </div>
          {expired ? (
            <Badge variant="secondary">Expired</Badge>
          ) : (
            <Badge variant="default" className="bg-green-500">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Diagnosis</p>
          <p className="text-sm">{prescription.diagnosis}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Medications</p>
          <div className="space-y-2">
            {prescription.medications && Array.isArray(prescription.medications) && prescription.medications.length > 0 ? (
              prescription.medications.map((med: Medication, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <Pill className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {med.name} - {med.dosage}
                    </p>
                    <p className="text-muted-foreground">
                      {med.frequency} {med.duration ? `for ${med.duration}` : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No medications listed</p>
            )}
          </div>
        </div>

        {prescription.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Notes</p>
            <p className="text-sm">{prescription.notes}</p>
          </div>
        )}

        {prescription.valid_until && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Valid until {formatDate(prescription.valid_until)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
