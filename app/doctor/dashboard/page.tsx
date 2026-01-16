import { getCurrentUser } from "@/lib/auth"
import { sql } from "@/lib/db"
import { DashboardHeader } from "@/components/dashboard/header"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Users, Clock, DollarSign, ArrowRight, CheckCircle } from "lucide-react"
import Link from "next/link"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { PendingRequests } from "@/components/doctor/pending-requests"

async function getDoctorStats(userId: string) {
  const today = new Date().toISOString().split("T")[0]
  const monthStart = startOfMonth(new Date()).toISOString()
  const monthEnd = endOfMonth(new Date()).toISOString()

  const [todayApts] = await sql`
    SELECT COUNT(*) as count FROM appointments 
    WHERE doctor_id = ${userId} AND DATE(scheduled_at) = ${today} AND status != 'cancelled'
  `
  const [totalPatients] = await sql`
    SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE doctor_id = ${userId}
  `
  const [pendingApts] = await sql`
    SELECT COUNT(*) as count FROM appointments 
    WHERE doctor_id = ${userId} AND status = 'pending'
  `
  const [unreadMsgs] = await sql`
    SELECT COUNT(*) as count FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.doctor_id = ${userId} AND m.is_read = false AND m.sender_id != ${userId}
  `
  const [earnings] = await sql`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE doctor_id = ${userId} AND status = 'completed'
    AND created_at BETWEEN ${monthStart} AND ${monthEnd}
  `

  return {
    todayAppointments: Number(todayApts.count),
    totalPatients: Number(totalPatients.count),
    pendingAppointments: Number(pendingApts.count),
    unreadMessages: Number(unreadMsgs.count),
    monthlyEarnings: Number(earnings.total),
  }
}

async function getTodayAppointments(userId: string) {
  const today = new Date().toISOString().split("T")[0]
  return sql`
    SELECT 
      a.id, a.scheduled_at as "scheduledAt", a.status, a.type, a.symptoms,
      u.id as "patientId", u.first_name as "patientFirstName", u.last_name as "patientLastName",
      u.avatar_url as "patientAvatar"
    FROM appointments a
    JOIN users u ON a.patient_id = u.id
    WHERE a.doctor_id = ${userId} AND DATE(a.scheduled_at) = ${today} AND a.status != 'cancelled'
    ORDER BY a.scheduled_at ASC
  `
}

async function getPendingAppointments(userId: string) {
  return sql`
    SELECT 
      a.id, a.scheduled_at as "scheduledAt", a.status, a.symptoms,
      u.id as "patientId", u.first_name as "patientFirstName", u.last_name as "patientLastName",
      u.avatar_url as "patientAvatar"
    FROM appointments a
    JOIN users u ON a.patient_id = u.id
    WHERE a.doctor_id = ${userId} AND a.status = 'pending'
    ORDER BY a.scheduled_at ASC
    LIMIT 5
  `
}

export default async function DoctorDashboard() {
  const user = await getCurrentUser()
  if (!user) return null

  const stats = await getDoctorStats(user.id)
  const todayAppointments = await getTodayAppointments(user.id)
  const pendingAppointments = await getPendingAppointments(user.id)

  return (
    <div className="min-h-screen">
      <DashboardHeader title={`Good ${getGreeting()}, Dr. ${user.lastName}`} subtitle="Here's your practice overview" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Today's Appointments"
            value={stats.todayAppointments}
            icon={<Calendar className="h-6 w-6" />}
          />
          <StatsCard title="Total Patients" value={stats.totalPatients} icon={<Users className="h-6 w-6" />} />
          <StatsCard
            title="Pending Requests"
            value={stats.pendingAppointments}
            icon={<Clock className="h-6 w-6" />}
            className={stats.pendingAppointments > 0 ? "border-warning" : ""}
          />
          <StatsCard
            title="Unread Messages"
            value={stats.unreadMessages}
            icon={<Users className="h-6 w-6" />}
            className={stats.unreadMessages > 0 ? "border-primary" : ""}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Today&apos;s Schedule</CardTitle>
                <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
              </div>
              <Link href="/doctor/appointments">
                <Button variant="ghost" size="sm" className="gap-1">
                  View all <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No appointments scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((apt: Record<string, unknown>) => (
                    <div key={apt.id as string} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="flex-shrink-0 w-16 text-center">
                        <p className="text-lg font-semibold">{format(new Date(apt.scheduledAt as string), "h:mm")}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(apt.scheduledAt as string), "a")}
                        </p>
                      </div>
                      <div className="h-12 w-px bg-border" />
                      <Avatar>
                        <AvatarImage src={(apt.patientAvatar as string) || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(apt.patientFirstName as string)[0]}
                          {(apt.patientLastName as string)[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {apt.patientFirstName as string} {apt.patientLastName as string}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {(apt.symptoms as string) || "General consultation"}
                        </p>
                      </div>
                      <Badge
                        variant={apt.status === "confirmed" ? "default" : "secondary"}
                        className={apt.status === "confirmed" ? "bg-success text-success-foreground" : ""}
                      >
                        {apt.status as string}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pending Requests</CardTitle>
                <CardDescription>Appointment requests awaiting confirmation</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <PendingRequests appointments={pendingAppointments as any} />
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for your practice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/doctor/appointments">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 bg-transparent">
                  <Calendar className="h-6 w-6" />
                  <span>Manage Schedule</span>
                </Button>
              </Link>
              <Link href="/doctor/patients">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 bg-transparent">
                  <Users className="h-6 w-6" />
                  <span>View Patients</span>
                </Button>
              </Link>
              <Link href="/doctor/messages">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 bg-transparent">
                  <Clock className="h-6 w-6" />
                  <span>Messages</span>
                </Button>
              </Link>
              <Link href="/doctor/prescriptions">
                <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2 bg-transparent">
                  <DollarSign className="h-6 w-6" />
                  <span>Write Prescription</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}
