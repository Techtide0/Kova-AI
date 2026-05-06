'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SmartFeedEntry {
  id: string
  type: string
  prompt: string
  why: string | null
  createdAt: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const ICONS: Record<string, string> = {
  CATEGORIZE_TRANSACTION: '🤖',
  GENERATE_PROPOSAL: '💡',
  ANALYZE_INCOME: '📊',
  SUGGEST_SAVINGS: '💰',
  FORECAST: '🔮',
  SUMMARIZE: '📝',
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

// ── FeedItem ──────────────────────────────────────────────────────────────────

function FeedItem({ entry, isNew }: { entry: SmartFeedEntry; isNew: boolean }) {
  const [open, setOpen] = useState(false)
  const icon = ICONS[entry.type] ?? '✨'

  return (
    <li
      className={`px-4 py-3.5 transition-colors ${
        isNew ? 'feed-new bg-emerald-50/70 dark:bg-emerald-900/10' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-base" role="img" aria-label={entry.type}>
          {icon}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">{entry.prompt}</p>

          {entry.why && (
            <>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  className={`transition-transform ${open ? 'rotate-180' : ''}`}
                >
                  <path d="M5 7 L1 3 L9 3 Z" />
                </svg>
                Why?
              </button>

              {open && (
                <p className="mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border border-zinc-100 dark:border-zinc-700">
                  {entry.why}
                </p>
              )}
            </>
          )}

          <p className="mt-1 text-[10px] text-zinc-400" suppressHydrationWarning>
            {timeAgo(entry.createdAt)}
          </p>
        </div>
      </div>
    </li>
  )
}

// ── SmartFeed ─────────────────────────────────────────────────────────────────

export function SmartFeed({ feed, latestId }: { feed: SmartFeedEntry[]; latestId: string | null }) {
  if (feed.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-8 text-center">
        <p className="text-sm text-zinc-400">AI activity will appear here</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" aria-live="polite">
        {feed.map((entry) => (
          <FeedItem key={entry.id} entry={entry} isNew={entry.id === latestId} />
        ))}
      </ul>
    </div>
  )
}
