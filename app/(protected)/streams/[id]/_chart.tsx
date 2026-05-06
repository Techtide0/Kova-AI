'use client'

import { useEffect, useRef, useState } from 'react'

export interface DayPoint {
  date: string
  revenue: number
  expenses: number
  cumulative: number
}

// ── Layout constants ──────────────────────────────────────────────────────────

const W = 560
const H = 180
const PAD = { top: 16, right: 16, bottom: 36, left: 56 }
const PW = W - PAD.left - PAD.right // 488
const PH = H - PAD.top - PAD.bottom // 128

// ── Scales ────────────────────────────────────────────────────────────────────

function xAt(i: number, n: number) {
  if (n <= 1) return PAD.left + PW / 2
  return PAD.left + (i / (n - 1)) * PW
}

function yAt(v: number, min: number, range: number) {
  return PAD.top + PH - ((v - min) / range) * PH
}

function fmtK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`
  return `₦${n.toFixed(0)}`
}

// ── Chart ─────────────────────────────────────────────────────────────────────

export function ProfitChart({ data }: { data: DayPoint[] }) {
  const lineRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <p className="text-sm text-zinc-400">No transactions yet — chart will appear here</p>
      </div>
    )
  }

  const values = data.map((d) => d.cumulative)
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(0, ...values)
  const range = rawMax - rawMin || 1

  // Slightly pad the Y range so the line isn't flush with the edges
  const yMin = rawMin - range * 0.08
  const yMax = rawMax + range * 0.08
  const yRange = yMax - yMin

  const n = data.length
  const pts = data.map((d, i) => ({ x: xAt(i, n), y: yAt(d.cumulative, yMin, yRange) }))
  const zeroY = yAt(0, yMin, yRange)

  const isPositive = data[data.length - 1].cumulative >= 0
  const lineColor = isPositive ? '#10b981' : '#ef4444'
  const areaColor = isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)'

  // Line path
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  // Area fill (close back along zero line)
  const areaPath =
    linePath +
    ` L${pts[n - 1].x.toFixed(1)},${zeroY.toFixed(1)}` +
    ` L${pts[0].x.toFixed(1)},${zeroY.toFixed(1)} Z`

  // Y-axis labels (4 ticks)
  const yTicks = [rawMin, rawMin + (rawMax - rawMin) / 2, rawMax].filter(
    (v, i, a) => a.indexOf(v) === i
  )

  // X-axis labels: first, middle, last (skip last when n === 1 to avoid duplicate)
  const xLabels: { i: number; label: string }[] = [{ i: 0, label: data[0].date }]
  if (n > 2) xLabels.push({ i: Math.floor((n - 1) / 2), label: data[Math.floor((n - 1) / 2)].date })
  if (n > 1) xLabels.push({ i: n - 1, label: data[n - 1].date })

  // Compute path length for animation (approximate: sum of segment lengths)
  let pathLen = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    pathLen += Math.sqrt(dx * dx + dy * dy)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        aria-label="Profit chart"
      >
        {/* Horizontal grid lines */}
        {yTicks.map((v) => {
          const y = yAt(v, yMin, yRange)
          return (
            <g key={v}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-zinc-100 dark:text-zinc-800"
                strokeDasharray={v === 0 ? '0' : '4 3'}
              />
              <text
                x={PAD.left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                className="fill-zinc-400"
              >
                {fmtK(v)}
              </text>
            </g>
          )
        })}

        {/* Zero line — only if range spans both sides */}
        {rawMin < 0 && rawMax > 0 && (
          <line
            x1={PAD.left}
            y1={zeroY}
            x2={W - PAD.right}
            y2={zeroY}
            stroke={lineColor}
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.4}
          />
        )}

        {/* Area fill */}
        <path d={areaPath} fill={areaColor} />

        {/* Animated line */}
        <path
          ref={lineRef}
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLen}
          strokeDashoffset={drawn ? 0 : pathLen}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Data points */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="white"
            stroke={lineColor}
            strokeWidth={2}
            className="dark:fill-zinc-900"
          />
        ))}

        {/* Latest value callout */}
        <g>
          <circle cx={pts[n - 1].x} cy={pts[n - 1].y} r={5} fill={lineColor} />
          <text
            x={pts[n - 1].x}
            y={pts[n - 1].y - 12}
            textAnchor={n > 1 ? 'end' : 'middle'}
            fontSize={11}
            fontWeight="600"
            fill={lineColor}
          >
            {fmtK(data[n - 1].cumulative)}
          </text>
        </g>

        {/* X-axis labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xAt(i, n)}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            className="fill-zinc-400"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}
