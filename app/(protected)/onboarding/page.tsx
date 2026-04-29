import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Set up your account' }

const steps = ['Your income sources', 'Review streams', 'Get your accounts']

export default function OnboardingPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                    i === 0
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border border-[var(--border)] text-[var(--fg-muted)]',
                  ].join(' ')}
                >
                  {i + 1}
                </div>
                <span className="text-[10px] text-[var(--fg-muted)] whitespace-nowrap">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="h-px flex-1 mx-3 bg-[var(--border)]" />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
              Tell us how you earn money
            </h1>
            <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
              Describe all your income sources in plain English. Kova will set up a dedicated
              account for each business stream automatically.
            </p>
          </div>

          {/* Placeholder input */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--fg)]">
              Your income sources
            </label>
            <textarea
              rows={5}
              placeholder="e.g. I sell ankara fabrics online, I tutor secondary school maths on weekends, and I receive a monthly salary from my bank job."
              className="block w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--fg-placeholder)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="text-xs text-[var(--fg-muted)]">
              Be as specific or brief as you like — the AI will parse and confirm each stream with you.
            </p>
          </div>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2">
            {['Ankara fabrics', 'Maths tutoring', 'Salary', 'Crypto trading', 'Freelance design'].map(
              (ex) => (
                <button
                  key={ex}
                  type="button"
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + {ex}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            Parse my income sources →
          </button>
        </div>

        <p className="text-center text-xs text-[var(--fg-muted)]">
          You can always add or edit streams from Settings later.
        </p>
      </div>
    </div>
  )
}
