import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ProfitChart, type DayPoint } from './_chart'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Chart data ────────────────────────────────────────────────────────────────

function buildChartData(
  txs: { type: string; amount: bigint | number | string; createdAt: Date }[]
): DayPoint[] {
  const byDate = new Map<string, { revenue: number; expenses: number }>()

  const sorted = [...txs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  for (const tx of sorted) {
    const key = fmtDateShort(tx.createdAt)
    const curr = byDate.get(key) ?? { revenue: 0, expenses: 0 }
    const amt = Number(tx.amount)
    if (tx.type === 'CREDIT') curr.revenue += amt
    else if (tx.type === 'DEBIT') curr.expenses += amt
    byDate.set(key, curr)
  }

  let cumulative = 0
  const points: DayPoint[] = []
  for (const [date, { revenue, expenses }] of byDate) {
    cumulative += revenue - expenses
    points.push({ date, revenue, expenses, cumulative })
  }
  return points
}

// ── Page ──────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const stream = await prisma.incomeStream.findUnique({ where: { id }, select: { name: true } })
  return { title: stream?.name ?? 'Stream Detail' }
}

export default async function StreamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const { id } = await params

  const stream = await prisma.incomeStream.findUnique({
    where: { id },
    include: {
      virtualAccount: true,
      transactions: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })

  // Guard: not found or belongs to another user
  if (!stream || stream.userId !== session?.user?.id) notFound()

  const txs = stream.transactions
  const revenue = txs.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = txs.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0)
  const profit = revenue - expenses
  const avgTx = txs.length > 0 ? revenue / txs.filter((t) => t.type === 'CREDIT').length : 0

  // Top category
  const catCounts: Record<string, number> = {}
  for (const tx of txs) {
    const cat = tx.categoryLabel ?? 'other'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  const chartData = buildChartData(
    txs.map((t) => ({ type: t.type as string, amount: Number(t.amount), createdAt: t.createdAt }))
  )
  // Chart expects ascending order
  chartData.reverse()

  const KIND_EMOJI: Record<string, string> = { BUSINESS: '🏪', SALARY: '💼' }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-6">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-(--fg-muted) hover:text-[var(--accent)] transition-colors"
        >
          ← Dashboard
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{KIND_EMOJI[stream.kind] ?? '💰'}</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{stream.name}</h1>
              <p className="text-xs text-(--fg-muted)">
                {stream.kind} · {stream.category ?? 'Uncategorised'}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              profit >= 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {profit >= 0 ? 'Profitable' : 'Net loss'}
          </span>
        </div>
      </div>

      {/* Virtual account */}
      {stream.virtualAccount && (
        <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-4">
          <p className="text-xs font-medium text-(--fg-muted) mb-1">Dedicated Virtual Account</p>
          <p className="text-lg font-mono font-bold tracking-widest text-foreground">
            {stream.virtualAccount.accountNumber}
          </p>
          <p className="text-xs text-(--fg-muted)">
            {stream.virtualAccount.bankName} · {stream.virtualAccount.accountName}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Revenue', value: fmt(revenue), color: 'text-foreground' },
          { label: 'Total Expenses', value: fmt(expenses), color: 'text-foreground' },
          {
            label: 'Net Profit',
            value: fmt(profit),
            color: profit >= 0 ? 'text-emerald-600' : 'text-red-500',
          },
          { label: 'Transactions', value: String(txs.length), color: 'text-foreground' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-(--border) bg-[var(--bg)] p-4 space-y-1"
          >
            <p className="text-xs text-(--fg-muted)">{label}</p>
            <p className={`text-lg font-bold tracking-tight ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Profit chart */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Cumulative Profit</h2>
        <ProfitChart data={chartData} />
      </section>

      {/* Activity summary */}
      <section className="rounded-2xl border border-(--border) bg-[var(--bg)] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Activity Summary</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-xs text-(--fg-muted)">Avg inflow</span>
            <span className="text-xs font-semibold text-foreground">
              {txs.length > 0 ? fmt(avgTx) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-(--fg-muted)">Top category</span>
            <span className="text-xs font-semibold text-foreground capitalize">
              {topCategory.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-(--fg-muted)">First transaction</span>
            <span className="text-xs font-semibold text-foreground">
              {txs.length > 0 ? fmtDate(txs[txs.length - 1].createdAt) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-(--fg-muted)">Latest transaction</span>
            <span className="text-xs font-semibold text-foreground">
              {txs.length > 0 ? timeAgo(txs[0].createdAt) : '—'}
            </span>
          </div>
        </div>
      </section>

      {/* Transaction list */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Transactions
          {txs.length >= 100 && (
            <span className="ml-2 text-[10px] font-normal text-(--fg-muted)">showing last 100</span>
          )}
        </h2>

        {txs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-(--border) px-4 py-10 text-center">
            <p className="text-sm text-zinc-400">No completed transactions yet.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Payments to your virtual account will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {txs.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                      tx.type === 'CREDIT'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30'
                        : 'bg-red-50 text-red-500 dark:bg-red-900/30'
                    }`}
                  >
                    {tx.type === 'CREDIT' ? '↓' : '↑'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description ?? tx.counterpartyName ?? 'Payment received'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {tx.categoryLabel?.replace(/_/g, ' ') ?? 'uncategorized'}
                      {tx.categoryConfidence != null && (
                        <span className="ml-1 opacity-60">
                          · {Math.round(tx.categoryConfidence * 100)}% confident
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-semibold ${
                        tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {tx.type === 'CREDIT' ? '+' : '−'}
                      {fmt(Number(tx.amount))}
                    </p>
                    <p className="text-[10px] text-zinc-400" suppressHydrationWarning>
                      {timeAgo(tx.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
