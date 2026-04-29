import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/auth'

export const metadata: Metadata = { title: 'Dashboard' }

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border p-5 space-y-1',
        accent
          ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5'
          : 'border-[var(--border)] bg-[var(--bg)]',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-[var(--fg-muted)]">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-[var(--fg)]">{value}</p>
      <p className="text-xs text-[var(--fg-muted)]">{sub}</p>
    </div>
  )
}

function EmptyCard({ title, description, cta, href }: { title: string; description: string; cta: string; href: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center space-y-3">
      <p className="text-sm font-medium text-[var(--fg)]">{title}</p>
      <p className="text-xs text-[var(--fg-muted)]">{description}</p>
      <Link
        href={href}
        className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        {cta}
      </Link>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
          Good day, {firstName}
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Here&apos;s your money at a glance.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total balance" value="₦—" sub="across all streams" accent />
        <StatCard label="This month's income" value="₦—" sub="all sources combined" />
        <StatCard label="This month's profit" value="₦—" sub="revenue minus expenses" />
        <StatCard label="Active streams" value="—" sub="income sources" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Smart Feed */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Smart Feed</h2>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
              AI actions
            </span>
          </div>
          <EmptyCard
            title="No actions yet"
            description="Kova will log every automated action here — categorizations, reminders, flags."
            cta="Set up income streams"
            href="/onboarding"
          />
        </section>

        {/* Proposals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Proposals</h2>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
              awaiting approval
            </span>
          </div>
          <EmptyCard
            title="No proposals"
            description="Tax set-asides, restock reminders, and savings suggestions will appear here for your approval."
            cta="Set up income streams"
            href="/onboarding"
          />
        </section>

        {/* Income Streams */}
        <section className="space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Income Streams</h2>
            <Link
              href="/onboarding"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              + Add stream
            </Link>
          </div>
          <EmptyCard
            title="No income streams yet"
            description="Create streams to get dedicated virtual accounts and per-hustle profit tracking."
            cta="Get started →"
            href="/onboarding"
          />
        </section>
      </div>

      {/* Ask Kova CTA */}
      <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--fg)]">Ask Kova anything</p>
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
            &ldquo;Can I afford to restock?&rdquo; &middot; &ldquo;Is anything weird happening with my money?&rdquo;
          </p>
        </div>
        <Link
          href="/chat"
          className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          Open chat →
        </Link>
      </div>
    </div>
  )
}
