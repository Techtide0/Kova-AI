'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'business' | 'everything' | 'personal'

interface StreamCard {
  id: string
  name: string
  emoji: string
  balance: string
  kind: string
  color: string
}

interface FeedItem {
  id: string
  icon: string
  text: string
  time: string
}

interface Proposal {
  id: string
  title: string
  description: string
  amount: string
}

// ── Fake data ──────────────────────────────────────────────────────────────────

const STREAM_CARDS: StreamCard[] = [
  {
    id: '1',
    name: 'Ankara Fabrics',
    emoji: '👗',
    balance: '₦0.00',
    kind: 'Business',
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
]

const FEED_ITEMS: FeedItem[] = [
  { id: '1', icon: '🤖', text: 'Kova is set up and watching your money.', time: 'Just now' },
]

const FAKE_PROPOSAL: Proposal = {
  id: '1',
  title: 'Set aside ₦5,000 for tax',
  description:
    'Based on your income this month, Kova recommends setting aside 5% for taxes before you spend it.',
  amount: '₦5,000',
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 transition-all animate-fade-in">
      {msg}
    </div>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const modes: { key: Mode; label: string }[] = [
    { key: 'business', label: 'Business' },
    { key: 'everything', label: 'Everything' },
    { key: 'personal', label: 'Personal' },
  ]
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-1 gap-0.5">
      {modes.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            mode === key
              ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Safety shield dropdown ────────────────────────────────────────────────────

function SafetyShield() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
      >
        <span>🛡️</span>
        <span>All clear</span>
        <span className="text-[10px] opacity-60">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl z-20 space-y-1">
          <p className="text-xs font-semibold text-[var(--fg)]">Safety Shield</p>
          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
            No anomalies detected. Kova is monitoring all your streams for unusual activity.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Stream card ───────────────────────────────────────────────────────────────

function StreamCardUI({ card }: { card: StreamCard }) {
  return (
    <div
      className={['shrink-0 w-44 rounded-2xl border p-4 space-y-3 snap-start', card.color].join(
        ' '
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl">{card.emoji}</span>
        <span className="rounded-full bg-[var(--bg)]/60 px-2 py-0.5 text-[10px] font-semibold text-[var(--fg-muted)]">
          {card.kind}
        </span>
      </div>
      <div>
        <p className="text-xs text-[var(--fg-muted)]">{card.name}</p>
        <p className="text-lg font-bold tracking-tight text-[var(--fg)]">{card.balance}</p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardClient({ name }: { name: string }) {
  const [mode, setMode] = useState<Mode>('everything')
  const [toast, setToast] = useState<string | null>(null)
  const [proposalDone, setProposalDone] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
  }

  function handleComingSoon() {
    showToast('Coming in Week 2 🚀')
  }

  function handleApprove() {
    setProposalDone(true)
    showToast('Proposal approved ✓')
  }

  function handleReject() {
    setProposalDone(true)
    showToast('Proposal dismissed.')
  }

  function handleWhy() {
    showToast('Kova flagged this based on your income patterns and Nigerian tax guidelines.')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-4 py-7 md:px-6 pb-24 md:pb-8">
      {/* 1. Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--fg)]">
            Good day, {name}
          </h1>
          <p className="text-xs text-[var(--fg-muted)]">Here&apos;s your money at a glance.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ModeToggle mode={mode} onChange={setMode} />
          <SafetyShield />
        </div>
      </div>

      {/* 2. Net Worth Pulse */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-6 py-5">
        <p className="text-xs font-medium text-[var(--fg-muted)] mb-0.5">
          Net position ·{' '}
          {mode === 'business' ? 'Business' : mode === 'personal' ? 'Personal' : 'All streams'}
        </p>
        <p className="text-3xl font-bold tracking-tight text-[var(--fg)]">₦0.00</p>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          No transactions yet.{' '}
          <Link href="/onboarding" className="text-[var(--accent)] hover:underline">
            Add your first stream →
          </Link>
        </p>
      </div>

      {/* 3. Ask the App */}
      <Link
        href="/chat"
        className="flex items-center gap-3 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-5 py-3.5 transition-colors hover:bg-[var(--accent)]/10 group"
      >
        <span className="text-xl">💬</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--fg)]">Ask Kova anything</p>
          <p className="text-xs text-[var(--fg-muted)] truncate">
            &ldquo;Can I afford to restock?&rdquo; &middot; &ldquo;Is anything weird with my
            money?&rdquo;
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-[var(--accent)] group-hover:translate-x-0.5 transition-transform">
          Open →
        </span>
      </Link>

      {/* 4. Stream Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--fg)]">Income Streams</h2>
          <Link
            href="/onboarding"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            + Add stream
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible">
          {STREAM_CARDS.map((card) => (
            <StreamCardUI key={card.id} card={card} />
          ))}
          {/* Add slot */}
          <Link
            href="/onboarding"
            className="shrink-0 w-44 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] py-6 snap-start text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <span className="text-2xl">+</span>
            <span className="text-xs font-medium">New stream</span>
          </Link>
        </div>
      </section>

      {/* 5 + 6. Smart Feed & Proposals — two-column on md+ */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Smart Feed */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Smart Feed</h2>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
              AI actions
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
            {FEED_ITEMS.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 text-base">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--fg)] leading-relaxed">{item.text}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Proposals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Proposals</h2>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] text-[var(--fg-muted)]">
              awaiting approval
            </span>
          </div>
          {proposalDone ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-center">
              <p className="text-xs text-[var(--fg-muted)]">No pending proposals.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--fg)]">{FAKE_PROPOSAL.title}</p>
                <p className="mt-1 text-xs text-[var(--fg-muted)] leading-relaxed">
                  {FAKE_PROPOSAL.description}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleWhy}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Why?
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 7. Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--fg)]">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/onboarding"
            className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
          >
            <span className="text-xl">➕</span>
            <span className="text-xs font-medium text-[var(--fg)]">Add Stream</span>
          </Link>
          {[
            { icon: '🧾', label: 'Send Invoice' },
            { icon: '💸', label: 'Request Payment' },
            { icon: '🔄', label: 'Move Money' },
          ].map(({ icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={handleComingSoon}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-center transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-muted)]"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-medium text-[var(--fg)]">{label}</span>
            </button>
          ))}
        </div>
      </section>

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
