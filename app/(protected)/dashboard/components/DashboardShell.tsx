'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SmartFeed, type SmartFeedEntry } from './SmartFeed'
import { useMode, type Mode } from '../../_context/mode-context'

// ── Types ─────────────────────────────────────────────────────────────────────

type TxType = 'CREDIT' | 'DEBIT' | 'TRANSFER'

interface Transaction {
  id: string
  incomeStreamId: string | null
  type: TxType
  amount: number
  currency: string
  description: string | null
  streamName: string
  categoryLabel: string | null
  aiReasoning: string | null
  createdAt: string
}

interface Stream {
  id: string
  name: string
  kind: string
  virtualAccount: { accountNumber: string; bankName: string } | null
}

interface StreamStats {
  revenue: number
  expenses: number
}

interface Props {
  streams: Stream[]
  initialTransactions: Transaction[]
  initialFeed: SmartFeedEntry[]
  initialStats: Record<string, StreamStats>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function timeAgo(iso: string) {
  const ms = new Date(iso).getTime()
  if (isNaN(ms)) return '—'
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const KIND_EMOJI: Record<string, string> = {
  BUSINESS: '🏪',
  SALARY: '💼',
}

const MODE_LABELS: { value: Mode; label: string }[] = [
  { value: 'everything', label: 'Everything' },
  { value: 'business', label: 'Business' },
  { value: 'personal', label: 'Personal' },
]

function kindMatchesMode(kind: string, mode: Mode) {
  if (mode === 'everything') return true
  if (mode === 'business') return kind === 'BUSINESS'
  return kind === 'SALARY'
}

// ── ModeToggle ────────────────────────────────────────────────────────────────

function ModeToggle() {
  const { mode, setMode } = useMode()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-(--border) bg-(--bg) p-1">
      {MODE_LABELS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === value
              ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
              : 'text-(--fg-muted) hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardShell({ streams, initialTransactions, initialFeed, initialStats }: Props) {
  const { mode } = useMode()
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [feed, setFeed] = useState<SmartFeedEntry[]>(initialFeed)
  const [connected, setConnected] = useState(false)
  const [streamStats, setStreamStats] = useState<Record<string, StreamStats>>(initialStats)
  const [latestFeedId, setLatestFeedId] = useState<string | null>(null)
  const [flashedStreamId, setFlashedStreamId] = useState<string | null>(null)
  const latestFeedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived filtered views
  const visibleStreams = streams.filter((s) => kindMatchesMode(s.kind, mode))
  const visibleStreamIds = new Set(visibleStreams.map((s) => s.id))
  const visibleTransactions = transactions.filter(
    (tx) => !tx.incomeStreamId || visibleStreamIds.has(tx.incomeStreamId)
  )

  useEffect(() => {
    let es: EventSource | null = null
    let retryDelay = 1000
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let unmounted = false

    function connect() {
      es = new EventSource('/api/stream')

      es.addEventListener('open', () => {
        retryDelay = 1000
        setConnected(true)
      })

      es.addEventListener('error', () => {
        setConnected(false)
        es?.close()
        es = null
        if (!unmounted) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30000)
            connect()
          }, retryDelay)
        }
      })

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            kind: string
            transaction?: Transaction
          }

          if (data.kind === 'transaction.created' && data.transaction) {
            const tx = data.transaction

            setTransactions((prev) => [tx, ...prev].slice(0, 20))

            if (tx.incomeStreamId) {
              const sid = tx.incomeStreamId
              setStreamStats((prev) => {
                const curr = prev[sid] ?? { revenue: 0, expenses: 0 }
                return {
                  ...prev,
                  [sid]: {
                    revenue: tx.type === 'CREDIT' ? curr.revenue + tx.amount : curr.revenue,
                    expenses: tx.type === 'DEBIT' ? curr.expenses + tx.amount : curr.expenses,
                  },
                }
              })
              if (flashTimer.current) clearTimeout(flashTimer.current)
              setFlashedStreamId(sid)
              flashTimer.current = setTimeout(() => setFlashedStreamId(null), 800)
            }

            const entry: SmartFeedEntry = {
              id: tx.id,
              type: 'CATEGORIZE_TRANSACTION',
              prompt: `Categorised ${fmt(tx.amount, tx.currency)} ${tx.type === 'CREDIT' ? 'inflow' : 'outflow'} into ${tx.streamName} as ${tx.categoryLabel ?? 'other'}`,
              why: tx.aiReasoning,
              createdAt: tx.createdAt,
            }
            setFeed((prev) => [entry, ...prev].slice(0, 15))
            if (latestFeedTimer.current) clearTimeout(latestFeedTimer.current)
            setLatestFeedId(tx.id)
            latestFeedTimer.current = setTimeout(() => setLatestFeedId(null), 600)
          }
        } catch {
          // Ignore heartbeats and malformed payloads
        }
      }
    }

    connect()

    return () => {
      unmounted = true
      if (retryTimer) clearTimeout(retryTimer)
      if (latestFeedTimer.current) clearTimeout(latestFeedTimer.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      es?.close()
    }
  }, [])

  return (
    <>
      <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-flash {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); }
          50%  { box-shadow: 0 0 0 8px rgba(34,197,94,0.08); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .feed-new  { animation: slide-down 0.35s ease-out both; }
        .card-flash { animation: card-flash 0.75s ease-out both; }
      `}</style>

      <div className="space-y-8">
        {/* Toolbar: live indicator + mode toggle */}
        <div className="flex items-center justify-between gap-4">
          <ModeToggle />
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full transition-colors ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-300'
              }`}
            />
            <span className={connected ? 'text-emerald-600 font-medium' : 'text-zinc-400'}>
              {connected ? 'Live' : 'Connecting…'}
            </span>
          </div>
        </div>

        {/* Stream Cards */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Income Streams</h2>
            <Link href="/onboarding" className="text-xs text-[var(--accent)] hover:underline">
              + Add stream
            </Link>
          </div>

          {visibleStreams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-(--border) p-8 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">
                {streams.length === 0 ? 'No streams yet' : `No ${mode} streams`}
              </p>
              <p className="text-xs text-(--fg-muted)">
                {streams.length === 0
                  ? 'Complete onboarding to add your first stream.'
                  : 'Switch to "Everything" to see all streams.'}
              </p>
              {streams.length === 0 && (
                <Link
                  href="/onboarding"
                  className="inline-block mt-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Get started →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleStreams.map((s) => {
                const stats = streamStats[s.id] ?? { revenue: 0, expenses: 0 }
                const profit = stats.revenue - stats.expenses
                const isFlashing = flashedStreamId === s.id

                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 ${
                      isFlashing ? 'card-flash' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{KIND_EMOJI[s.kind] ?? '💰'}</span>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-zinc-400">{s.kind}</p>
                        </div>
                      </div>
                      <Link
                        href={`/streams/${s.id}`}
                        className="text-[10px] font-medium text-[var(--accent)] hover:underline shrink-0"
                      >
                        View →
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2">
                        <p className="text-[10px] text-zinc-400 mb-0.5">Revenue</p>
                        <p className="text-sm font-bold text-foreground">
                          {stats.revenue > 0 ? fmt(stats.revenue) : '₦—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2">
                        <p className="text-[10px] text-zinc-400 mb-0.5">Profit</p>
                        <p
                          className={`text-sm font-bold ${
                            profit > 0
                              ? 'text-emerald-600'
                              : profit < 0
                                ? 'text-red-500'
                                : 'text-foreground'
                          }`}
                        >
                          {stats.revenue > 0 || stats.expenses > 0 ? fmt(profit) : '₦—'}
                        </p>
                      </div>
                    </div>

                    {s.virtualAccount && (
                      <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2">
                        <p className="text-[10px] text-zinc-400">{s.virtualAccount.bankName}</p>
                        <p className="font-mono text-xs font-semibold text-foreground tracking-wider">
                          {s.virtualAccount.accountNumber}
                        </p>
                      </div>
                    )}

                    {isFlashing && (
                      <p className="text-[10px] font-semibold text-emerald-600 text-center">
                        ✓ New transaction received
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Transactions */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Transactions</h2>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              {visibleTransactions.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No transactions yet</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visibleTransactions.slice(0, 10).map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.streamName}
                        </p>
                        <p className="truncate text-xs text-zinc-400" suppressHydrationWarning>
                          {tx.categoryLabel ?? 'uncategorized'} · {timeAgo(tx.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`ml-4 shrink-0 text-sm font-semibold ${
                          tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {tx.type === 'CREDIT' ? '+' : '−'}
                        {fmt(tx.amount, tx.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Smart Feed */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Smart Feed</h2>
            <SmartFeed feed={feed} latestId={latestFeedId} />
          </section>
        </div>
      </div>
    </>
  )
}
