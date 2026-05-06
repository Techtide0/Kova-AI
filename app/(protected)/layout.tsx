import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { ThemeToggle } from '@/app/_components/theme-toggle'
import { SidebarNav, MobileNav } from '@/app/_components/sidebar-nav'
import { ClientProviders } from './layout-client'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const initials =
    (session.user?.name || '')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">
      {/* ── Top header (mobile: shows logo + avatar; desktop: hidden) ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4 md:hidden">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight text-[var(--fg)]">
          Kova
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div
            aria-label={session.user?.name || 'User'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-fg)]"
          >
            {initials}
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar (desktop only) ── */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
          {/* Logo */}
          <div className="flex h-14 items-center border-b border-[var(--border)] px-5">
            <Link
              href="/dashboard"
              className="text-base font-semibold tracking-tight text-[var(--fg)]"
            >
              Kova
            </Link>
          </div>

          {/* Nav items */}
          <SidebarNav />

          {/* User section at the bottom */}
          <div className="mt-auto border-t border-[var(--border)] p-3">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-fg)]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--fg)]">
                  {session.user?.name}
                </p>
                <p className="truncate text-xs text-[var(--fg-muted)]">{session.user?.email}</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Page header bar (desktop) */}
          <div className="hidden h-14 shrink-0 items-center justify-end border-b border-[var(--border)] px-6 md:flex">
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/login' })
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
              >
                Sign out
              </button>
            </form>
          </div>

          {/* Scrollable page area */}
          <main className="flex-1 overflow-y-auto">
            <ClientProviders>{children}</ClientProviders>
          </main>
        </div>
      </div>

      {/* ── Bottom tab bar (mobile only) ── */}
      <MobileNav />
    </div>
  )
}
