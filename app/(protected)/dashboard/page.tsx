import type { Metadata } from 'next'
import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DashboardShell } from './components/DashboardShell'

export const metadata: Metadata = { title: 'Dashboard' }

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

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
          : 'border-(--border) bg-background',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-(--fg-muted)">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-(--fg-muted)">{sub}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const firstName = session.user.name?.split(' ')[0] ?? 'there'
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [streams, transactions, aiActions] = await Promise.all([
    prisma.incomeStream.findMany({
      where: { userId, isActive: true },
      include: {
        virtualAccount: { select: { accountNumber: true, bankName: true } },
        transactions: {
          where: { status: 'COMPLETED' },
          select: { type: true, amount: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { incomeStream: { select: { name: true } } },
    }),
    prisma.aIAction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  // Per-stream stats for the live shell
  const initialStats: Record<string, { revenue: number; expenses: number }> = {}
  let totalRevenue = 0
  let monthlyIncome = 0
  let monthlyProfit = 0

  for (const s of streams) {
    const txs = s.transactions
    const revenue = txs
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = txs
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const mRevenue = txs
      .filter((t) => t.type === 'CREDIT' && t.createdAt >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const mExpenses = txs
      .filter((t) => t.type === 'DEBIT' && t.createdAt >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    initialStats[s.id] = { revenue, expenses }
    totalRevenue += revenue
    monthlyIncome += mRevenue
    monthlyProfit += mRevenue - mExpenses
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Good day, {firstName}
          </h1>
          <p className="mt-1 text-sm text-(--fg-muted)">Here&apos;s your money at a glance.</p>
        </div>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-(--border) bg-background px-3 py-1.5 text-sm text-(--fg-muted) transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={totalRevenue > 0 ? fmt(totalRevenue) : '₦—'}
          sub="across all streams"
          accent
        />
        <StatCard
          label="This month's income"
          value={monthlyIncome > 0 ? fmt(monthlyIncome) : '₦—'}
          sub="all sources combined"
        />
        <StatCard
          label="This month's profit"
          value={monthlyProfit > 0 ? fmt(monthlyProfit) : '₦—'}
          sub="revenue minus expenses"
        />
        <StatCard label="Active streams" value={String(streams.length)} sub="income sources" />
      </div>

      {/* Live shell — streams, transactions, smart feed */}
      <DashboardShell
        streams={streams.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          virtualAccount: s.virtualAccount
            ? { accountNumber: s.virtualAccount.accountNumber, bankName: s.virtualAccount.bankName }
            : null,
        }))}
        initialTransactions={transactions.map((tx) => ({
          id: tx.id,
          incomeStreamId: tx.incomeStreamId,
          type: tx.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
          amount: Number(tx.amount),
          currency: tx.currency,
          description: tx.description,
          streamName: tx.incomeStream?.name ?? 'Unknown stream',
          categoryLabel: tx.categoryLabel,
          aiReasoning: tx.aiReasoning,
          createdAt: tx.createdAt.toISOString(),
        }))}
        initialFeed={aiActions.map((a) => ({
          id: a.id,
          type: a.type as string,
          prompt: a.prompt,
          why: (a.result as { aiReasoning?: string } | null)?.aiReasoning ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
        initialStats={initialStats}
      />

      {/* Ask Kova CTA */}
      <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Ask Kova anything</p>
          <p className="mt-0.5 text-xs text-(--fg-muted)">
            &ldquo;Can I afford to restock?&rdquo; &middot; &ldquo;Is anything weird happening with
            my money?&rdquo;
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
