import React from 'react'
import type { ContextEvent, ContextEventType } from '@shared/types/context.types'

interface ContextEventPillProps {
  event: ContextEvent
}

const STYLES: Record<ContextEventType, { icon: string; bg: string; text: string }> = {
  context_warning: {
    icon: '\u26A0\uFE0F',
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-400'
  },
  context_offloaded: {
    icon: '\uD83D\uDCE6',
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-400'
  },
  context_truncated: {
    icon: '\u2702\uFE0F',
    bg: 'bg-orange-500/10 border-orange-500/30',
    text: 'text-orange-400'
  },
  context_summary_started: {
    icon: '\uD83D\uDD04',
    bg: 'bg-sky-500/10 border-sky-500/30',
    text: 'text-sky-400'
  },
  context_summary_completed: {
    icon: '\u2705',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-400'
  },
  context_summary_failed: {
    icon: '\u274C',
    bg: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400'
  },
  context_budget_info: {
    icon: '\uD83D\uDCCA',
    bg: 'bg-[var(--color-bg-surface-2)] border-[var(--color-border)]',
    text: 'text-[var(--color-text-muted)]'
  }
}

export function ContextEventPill({ event }: ContextEventPillProps) {
  const style = STYLES[event.type]

  return (
    <div
      className={`mx-auto my-1 flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] leading-tight ${style.bg} ${style.text}`}
    >
      <span>{style.icon}</span>
      <span>{event.message}</span>
    </div>
  )
}
