import type { Metadata } from 'next'
import { auth, signOut } from '@/auth'

export const metadata: Metadata = { title: 'Settings' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--fg-muted)]">
        {title}
      </h2>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
        {children}
      </div>
    </section>
  )
}

function Row({ label, value, action }: { label: string; value?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--fg)]">{label}</p>
        {value && <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{value}</p>}
      </div>
      {action}
    </div>
  )
}

export default async function SettingsPage() {
  const session = await auth()

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Manage your account and income streams.</p>
      </div>

      <Section title="Account">
        <Row
          label="Full name"
          value={session?.user?.name ?? '—'}
          action={
            <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]">
              Edit
            </button>
          }
        />
        <Row
          label="Email"
          value={session?.user?.email ?? '—'}
        />
        <Row
          label="Password"
          value="••••••••••"
          action={
            <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]">
              Change
            </button>
          }
        />
      </Section>

      <Section title="Income Streams">
        <Row
          label="Manage streams"
          value="Add, rename, or remove your income sources"
          action={
            <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]">
              Manage
            </button>
          }
        />
        <Row
          label="Virtual accounts"
          value="View your Squad NUBANs for each business stream"
          action={
            <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)]">
              View
            </button>
          }
        />
      </Section>

      <Section title="Notifications">
        <Row
          label="Anomaly alerts"
          value="Get notified when Kova flags an unusual transaction"
          action={
            <div className="h-5 w-9 rounded-full bg-[var(--accent)] opacity-50 cursor-not-allowed" aria-label="Toggle (coming soon)" />
          }
        />
        <Row
          label="Weekly summary"
          value="Receive a weekly profit snapshot across all streams"
          action={
            <div className="h-5 w-9 rounded-full bg-[var(--border)] opacity-50 cursor-not-allowed" aria-label="Toggle (coming soon)" />
          }
        />
      </Section>

      <Section title="Danger Zone">
        <Row
          label="Sign out"
          value="Sign out of this device"
          action={
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/login' })
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                Sign out
              </button>
            </form>
          }
        />
        <Row
          label="Delete account"
          value="Permanently delete your account and all data"
          action={
            <button
              disabled
              className="rounded-lg border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] opacity-40 cursor-not-allowed"
            >
              Delete
            </button>
          }
        />
      </Section>
    </div>
  )
}
