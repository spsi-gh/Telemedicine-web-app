"use client"

interface HeaderProps {
  title: string
  subtitle?: string
}

export function DashboardHeader({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  )
}
