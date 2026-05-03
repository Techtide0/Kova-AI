import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ask Kova' }

const suggestedPrompts = [
  'Can I afford to restock my ankara fabrics this week?',
  'Is anything unusual happening with my money?',
  'What was my most profitable hustle last month?',
  'How much have I spent on business expenses so far?',
  'Am I on track to hit ₦200k profit this month?',
]

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8 text-center">
          {/* Kova avatar */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-lg font-bold text-[var(--accent-fg)]">
            K
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--fg)]">
              Ask me anything about your money
            </h2>
            <p className="text-sm text-[var(--fg-muted)]">
              Every answer is grounded in your actual transactions — no guesses.
            </p>
          </div>

          {/* Suggested prompts */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-left">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-muted)] text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-3">
          <textarea
            rows={1}
            placeholder="Ask about your money…"
            className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--fg-placeholder)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
            aria-label="Send"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--fg-muted)]">
          Kova reads your real transaction data. It cannot move money without your approval.
        </p>
      </div>
    </div>
  )
}
