'use client'

import { useEffect, useState } from 'react'

interface Transaction {
  id: string
  amount: number
  currency: string
  description: string | null
  streamName: string
  categoryLabel: string | null
  aiReasoning: string | null
  createdAt: string
}

interface SmartFeedEntry {
  id: string
  prompt: string
  createdAt: string
}

interface Stream {
  id: string
  name: string
  kind: string
  virtualAccount: { accountNumber: string; bankName: string } | null
}

interface Props {
  userName: string
  streams: Stream[]
  initialTransactions: Transaction[]
  initialFeed: SmartFeedEntry[]
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function DashboardShell({ userName, streams, initialTransactions, initialFeed }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [feed, setFeed] = useState<SmartFeedEntry[]>(initialFeed)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/stream')

    es.addEventListener('open', () => setConnected(true))
    es.addEventListener('error', () => setConnected(false))

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          kind: string
          transaction?: Transaction
        }

        if (data.kind === 'transaction.created' && data.transaction) {
          setTransactions((prev) => [data.transaction!, ...prev])
          setFeed((prev) => [
            {
              id: data.transaction!.id,
              prompt: `Categorized ${formatNaira(data.transaction!.amount)} inflow into ${data.transaction!.streamName} as ${data.transaction!.categoryLabel ?? 'other'}`,
              createdAt: data.transaction!.createdAt,
            },
            ...prev,
          ])
        }
      } catch {
        // Ignore parse errors (heartbeat comments from SSE)
      }
    }

    return () => es.close()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Welcome back, {userName}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-zinc-300'}`}
            />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        </div>

        {/* Stream Cards */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Income Streams
          </h2>
          {streams.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No streams yet. Complete onboarding to add streams.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{s.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{s.kind}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.kind === 'BUSINESS'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {s.kind}
                    </span>
                  </div>
                  {s.virtualAccount && (
                    <div className="mt-3 rounded-lg bg-zinc-50 p-2">
                      <p className="text-xs text-zinc-500">{s.virtualAccount.bankName}</p>
                      <p className="font-mono text-sm font-medium text-zinc-900">
                        {s.virtualAccount.accountNumber}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Transactions */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-zinc-500 uppercase tracking-wider">
              Recent Transactions
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              {transactions.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">No transactions yet</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {transactions.slice(0, 20).map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {tx.streamName}
                        </p>
                        <p className="truncate text-xs text-zinc-400">
                          {tx.categoryLabel ?? 'uncategorized'} · {timeAgo(tx.createdAt)}
                        </p>
                      </div>
                      <span className="ml-4 shrink-0 text-sm font-semibold text-green-600">
                        +{formatNaira(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Smart Feed */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-zinc-500 uppercase tracking-wider">
              Smart Feed
            </h2>
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              {feed.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400">
                  AI activity will appear here
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {feed.slice(0, 15).map((entry) => (
                    <li key={entry.id} className="px-4 py-3">
                      <p className="text-sm text-zinc-700">{entry.prompt}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(entry.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
