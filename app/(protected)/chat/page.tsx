'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant'

interface Message {
  id: string
  role: Role
  content: string
  streaming?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTED = [
  'Can I afford to restock my ankara fabrics this week?',
  'Is anything unusual happening with my money?',
  'What was my most profitable hustle last month?',
  'How much have I spent on business expenses so far?',
  'Am I on track to hit ₦200k profit this month?',
]

// ── KovaAvatar ────────────────────────────────────────────────────────────────

function KovaAvatar({ size = 8 }: { size?: number }) {
  return (
    <div
      style={{ height: `${size * 0.25}rem`, width: `${size * 0.25}rem` }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]"
    >
      K
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <KovaAvatar />}

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-[var(--accent-fg)] rounded-tr-sm'
            : 'bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-tl-sm'
        }`}
      >
        {msg.content}
        {msg.streaming && (
          <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-current opacity-60" />
        )}
      </div>
    </div>
  )
}

// ── ToolIndicator ─────────────────────────────────────────────────────────────

function ToolIndicator({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <KovaAvatar size={6} />
      <span className="flex items-center gap-1.5">
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        {message}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [toolMsg, setToolMsg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolMsg])

  // Auto-resize textarea
  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const assistantId = crypto.randomUUID()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setStreaming(true)
    setToolMsg(null)

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      type StreamEvent =
        | { type: 'tool'; message: string }
        | { type: 'token'; content: string }
        | { type: 'done' }
        | { type: 'error'; message: string }

      function processEvent(raw: string) {
        if (!raw.trim()) return
        try {
          const event = JSON.parse(raw) as StreamEvent
          if (event.type === 'tool') {
            setToolMsg(event.message)
          } else if (event.type === 'token') {
            setToolMsg(null)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.content } : m
              )
            )
          } else if (event.type === 'done') {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
            )
          } else if (event.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: event.message, streaming: false } : m
              )
            )
          }
        } catch {
          // skip malformed line
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any data remaining in the buffer when the stream closes
          processEvent(buffer)
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) processEvent(line)
      }
    } catch (err) {
      console.error('[chat] fetch error:', err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong — please try again.', streaming: false }
            : m
        )
      )
    } finally {
      setStreaming(false)
      setToolMsg(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl space-y-8 text-center">
              <KovaAvatar size={12} />

              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[var(--fg)]">
                  Ask me anything about your money
                </h2>
                <p className="text-sm text-[var(--fg-muted)]">
                  Every answer is grounded in your actual transactions — no guesses.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
                {SUGGESTED.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-left text-sm text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-muted)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Message thread */
          <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {toolMsg && <ToolIndicator message={toolMsg} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              resizeTextarea()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your money…"
            aria-label="Message input"
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--fg-placeholder)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!input.trim() || streaming}
            onClick={() => void sendMessage(input)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40"
            aria-label="Send"
          >
            {streaming ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="animate-spin"
              >
                <path
                  d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4z"
                  opacity=".3"
                />
                <path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z" />
              </svg>
            ) : (
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
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--fg-muted)]">
          Kova reads your real transaction data. It cannot move money without your approval.
        </p>
      </div>
    </div>
  )
}
