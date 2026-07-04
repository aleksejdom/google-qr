import Link from 'next/link'
import {
  LayoutDashboard,
  MapPin,
  Megaphone,
  Users,
  MessageSquare,
  CheckSquare,
  Settings,
  LogOut,
  Star,
} from 'lucide-react'
import { requireSession } from '@/lib/session'
import { logoutAction } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/locations', label: 'Standorte & QR', icon: MapPin },
  { href: '/campaigns', label: 'Kampagnen', icon: Megaphone },
  { href: '/contacts', label: 'Kontakte', icon: Users },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/tasks', label: 'Aufgaben', icon: CheckSquare },
  { href: '/settings', label: 'Einstellungen', icon: Settings },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 px-5 py-5">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <span className="font-semibold">ReviewPilot</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <p className="truncate text-sm font-medium">{session.name}</p>
          <p className="mb-3 truncate text-xs text-zinc-500">{session.orgName}</p>
          <form action={logoutAction}>
            <Button variant="outline" size="sm" className="w-full">
              <LogOut className="h-3.5 w-3.5" /> Abmelden
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-8">{children}</main>
    </div>
  )
}
