'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Mock parser ───────────────────────────────────────────────────────────────

type StreamKind = 'Business' | 'Employment' | 'Investment' | 'Freelance' | 'Other'

interface MockStream {
  id: string
  name: string
  kind: StreamKind
  category: string
  emoji: string
}

const STREAM_PATTERNS: {
  keywords: string[]
  name: string
  kind: StreamKind
  category: string
  emoji: string
}[] = [
  {
    keywords: ['ankara', 'fabric', 'cloth', 'fashion', 'sew', 'tailoring', 'dress', 'outfit'],
    name: 'Fashion Business',
    kind: 'Business',
    category: 'Retail',
    emoji: '👗',
  },
  {
    keywords: [
      'tutor',
      'teach',
      'lesson',
      'coach',
      'class',
      'school',
      'student',
      'maths',
      'math',
      'english',
      'subject',
    ],
    name: 'Tutoring',
    kind: 'Freelance',
    category: 'Education',
    emoji: '📚',
  },
  {
    keywords: [
      'salary',
      'job',
      'office',
      'company',
      'work',
      'employed',
      'employer',
      'payslip',
      '9-5',
      'monthly pay',
    ],
    name: 'Salary',
    kind: 'Employment',
    category: 'Employment',
    emoji: '💼',
  },
  {
    keywords: [
      'crypto',
      'bitcoin',
      'btc',
      'eth',
      'ethereum',
      'trade',
      'trading',
      'binance',
      'coin',
      'token',
    ],
    name: 'Crypto Trading',
    kind: 'Investment',
    category: 'Finance',
    emoji: '₿',
  },
  {
    keywords: ['freelance', 'design', 'logo', 'brand', 'graphic', 'ui', 'ux', 'figma', 'photoshop'],
    name: 'Freelance Design',
    kind: 'Freelance',
    category: 'Creative',
    emoji: '🎨',
  },
  {
    keywords: ['write', 'writing', 'content', 'copywrite', 'blog', 'article', 'newsletter'],
    name: 'Content Writing',
    kind: 'Freelance',
    category: 'Creative',
    emoji: '✍️',
  },
  {
    keywords: [
      'food',
      'cook',
      'catering',
      'bake',
      'cake',
      'restaurant',
      'kitchen',
      'meal',
      'snack',
      'eat',
    ],
    name: 'Food Business',
    kind: 'Business',
    category: 'Food & Bev',
    emoji: '🍱',
  },
  {
    keywords: [
      'resell',
      'resale',
      'market',
      'buy and sell',
      'thrift',
      'goods',
      'product',
      'sell online',
      'jiji',
      'jumia',
    ],
    name: 'Reselling',
    kind: 'Business',
    category: 'Retail',
    emoji: '🛒',
  },
  {
    keywords: [
      'pos',
      'agent banking',
      'transfer',
      'withdrawal',
      'cash out',
      'opay',
      'moniepoint',
      'palmpay',
    ],
    name: 'POS Business',
    kind: 'Business',
    category: 'Finance',
    emoji: '🏧',
  },
  {
    keywords: [
      'youtube',
      'tiktok',
      'instagram',
      'content creat',
      'influenc',
      'social media',
      'follower',
      'subscriber',
    ],
    name: 'Content Creation',
    kind: 'Freelance',
    category: 'Media',
    emoji: '📱',
  },
  {
    keywords: [
      'real estate',
      'property',
      'rent',
      'land',
      'house',
      'apartment',
      'shortlet',
      'airbnb',
    ],
    name: 'Real Estate',
    kind: 'Investment',
    category: 'Property',
    emoji: '🏠',
  },
  {
    keywords: ['dev', 'develop', 'code', 'software', 'app', 'website', 'web', 'program'],
    name: 'Software Dev',
    kind: 'Freelance',
    category: 'Tech',
    emoji: '💻',
  },
  {
    keywords: [
      'transport',
      'drive',
      'uber',
      'bolt',
      'taxify',
      'logistics',
      'delivery',
      'dispatch',
      'ride',
    ],
    name: 'Transport / Logistics',
    kind: 'Business',
    category: 'Logistics',
    emoji: '🚗',
  },
  {
    keywords: ['invest', 'dividend', 'stock', 'share', 'bond', 'mutual fund', 'portfolio'],
    name: 'Investments',
    kind: 'Investment',
    category: 'Finance',
    emoji: '📈',
  },
]

function mockParse(text: string): MockStream[] {
  const lower = text.toLowerCase()
  const found: MockStream[] = []
  const seen = new Set<string>()

  for (const pattern of STREAM_PATTERNS) {
    if (pattern.keywords.some((kw) => lower.includes(kw)) && !seen.has(pattern.name)) {
      seen.add(pattern.name)
      found.push({ id: crypto.randomUUID(), ...pattern })
    }
  }

  if (found.length === 0) {
    found.push({
      id: crypto.randomUUID(),
      name: 'General Income',
      kind: 'Other',
      category: 'Other',
      emoji: '💰',
    })
  }

  return found
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const CHIPS = [
  'Salary',
  'Freelancing',
  'Tutoring',
  'POS Business',
  'Reselling',
  'Content Creation',
  'Crypto Trading',
  'Food Business',
  'Fashion',
]

// ── Kind badge colour map ─────────────────────────────────────────────────────

const KIND_COLORS: Record<StreamKind, string> = {
  Business: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  Employment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  Investment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  Freelance: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  Other: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Your income sources', 'Review streams', 'Get your accounts']

function StepDots({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-sm mx-auto">
      {STEPS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < active
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : i === active
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-[var(--bg)]'
                    : 'border border-[var(--border)] text-[var(--fg-muted)]',
              ].join(' ')}
            >
              {i < active ? '✓' : i + 1}
            </div>
            <span className="text-[10px] text-[var(--fg-muted)] whitespace-nowrap">{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className="h-px flex-1 mx-2 bg-[var(--border)]" />}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 'input' | 'thinking' | 'review' | 'confirm'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [streams, setStreams] = useState<MockStream[]>([])

  function handleChip(chip: string) {
    setText((t) => {
      const trimmed = t.trim()
      if (!trimmed) return chip
      if (trimmed.endsWith(',')) return `${trimmed} ${chip}`
      return `${trimmed}, ${chip}`
    })
  }

  function handleParse() {
    if (!text.trim()) return
    setStep('thinking')
    setTimeout(() => {
      setStreams(mockParse(text))
      setStep('review')
    }, 1600)
  }

  function handleConfirm() {
    setStep('confirm')
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  const dotIndex = step === 'input' || step === 'thinking' ? 0 : step === 'review' ? 1 : 2

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <StepDots active={dotIndex} />

        {/* ── Screen 1 + 2: Input ── */}
        {(step === 'input' || step === 'thinking') && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--fg)]">
                What do you do to make money?
              </h1>
              <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
                Tell Kova in your own words. Every income source — big or small. We&apos;ll set up a
                dedicated virtual account for each one.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="income-sources"
                className="block text-sm font-medium text-[var(--fg)]"
              >
                Your income sources
              </label>
              <textarea
                id="income-sources"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={step === 'thinking'}
                placeholder="e.g. I sell ankara fabrics online, tutor secondary school maths on weekends, and get a monthly salary from my bank job."
                className="block w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--fg-placeholder)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
              />
              <p className="text-xs text-[var(--fg-muted)]">
                Be as specific or brief as you like — Kova will parse and confirm each stream with
                you.
              </p>
            </div>

            {/* Suggestion chips */}
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--fg-muted)]">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={step === 'thinking'}
                    onClick={() => handleChip(chip)}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!text.trim() || step === 'thinking'}
              onClick={handleParse}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'thinking' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Kova is parsing your income sources…
                </span>
              ) : (
                'Parse my income sources →'
              )}
            </button>
          </div>
        )}

        {/* ── Screen 3: Review ── */}
        {step === 'review' && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">
                Got it.
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--fg)]">
                We&apos;ll set up {streams.length} income stream{streams.length !== 1 ? 's' : ''}{' '}
                for you.
              </h1>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                Each stream gets its own virtual account. Tap a card to rename it before confirming.
              </p>
            </div>

            <div className="space-y-3">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3"
                >
                  <span className="text-2xl" role="img" aria-label={s.name}>
                    {s.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--fg)] truncate">{s.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{s.category}</p>
                  </div>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                      KIND_COLORS[s.kind],
                    ].join(' ')}
                  >
                    {s.kind}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--bg-muted)]"
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-[2] rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Yes, that&apos;s right →
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 4: Confirming ── */}
        {step === 'confirm' && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--fg)]">Setting up your streams…</h1>
            <p className="text-sm text-[var(--fg-muted)]">Taking you to your dashboard.</p>
          </div>
        )}

        <p className="text-center text-xs text-[var(--fg-muted)]">
          You can always add or edit streams from Settings later.
        </p>
      </div>
    </div>
  )
}
