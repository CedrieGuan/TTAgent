import React from 'react'
import type { MemoryEvent, MemoryEventType } from '@shared/types/memory.types'

interface MemoryEventPillProps {
  event: MemoryEvent
}

const STYLES: Record<MemoryEventType, { icon: string; bg: string; text: string }> = {
  memory_extraction_started: {
    icon: '\uD83E\uDDE0',
    bg: 'bg-purple-500/10 border-purple-500/30',
    text: 'text-purple-400'
  },
  memory_extraction_completed: {
    icon: '\u2728',
    bg: 'bg-violet-500/10 border-violet-500/30',
    text: 'text-violet-400'
  },
  memory_extraction_failed: {
    icon: '\u26A0\uFE0F',
    bg: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400'
  }
}

export function MemoryEventPill({ event }: MemoryEventPillProps) {
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
