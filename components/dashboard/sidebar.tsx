"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Heart,
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquare,
  Pill,
  CreditCard,
  User,
  Settings,
  LogOut,
  Users,
  BarChart3,
  Stethoscope,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AuthUser } from "@/types"

interface SidebarProps {
  user: AuthUser
}

const patientNavItems = [
  { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/doctors", label: "Find Doctors", icon: Stethoscope },
  { href: "/patient/reports", label: "Medical Reports", icon: FileText },
  { href: "/patient/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/patient/messages", label: "Messages", icon: MessageSquare },
  { href: "/patient/billing", label: "Billing", icon: CreditCard },
  { href: "/patient/profile", label: "Profile", icon: User },
]

const doctorNavItems = [
  { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
  { href: "/doctor/patients", label: "My Patients", icon: Users },
  { href: "/doctor/messages", label: "Messages", icon: MessageSquare },
  { href: "/doctor/prescriptions", label: "Prescriptions", icon: Pill },
  { href: "/doctor/earnings", label: "Earnings", icon: CreditCard },
  { href: "/doctor/profile", label: "Profile", icon: User },
]

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/appointments", label: "Appointments", icon: Calendar },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const navItems = user.role === "patient" ? patientNavItems : user.role === "doctor" ? doctorNavItems : adminNavItems

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Heart className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold">MediConnect</span>
      </div>

      {/* User Info */}
      <div className="border-b p-6">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={user.avatarUrl || undefined} alt={user.firstName} />
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-6">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t p-6">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
