'use client'

import { ModeProvider } from './_context/mode-context'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ModeProvider>{children}</ModeProvider>
}
