'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Mode = 'everything' | 'business' | 'personal'

interface ModeCtx {
  mode: Mode
  setMode: (m: Mode) => void
}

const Ctx = createContext<ModeCtx>({ mode: 'everything', setMode: () => {} })

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('everything')

  useEffect(() => {
    const saved = localStorage.getItem('kova-mode') as Mode | null
    if (saved && ['everything', 'business', 'personal'].includes(saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModeState(saved)
    }
  }, [])

  function setMode(m: Mode) {
    setModeState(m)
    localStorage.setItem('kova-mode', m)
  }

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>
}

export const useMode = () => useContext(Ctx)
