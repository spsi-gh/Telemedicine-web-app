import type React from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { Sidebar } from "@/components/dashboard/sidebar"

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  if (user.role !== "doctor") {
    redirect(`/${user.role}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar user={user} />
      <main className="pl-64 pr-6">{children}</main>
    </div>
  )
}
