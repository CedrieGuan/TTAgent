import React, { useState } from 'react'
import type { MCPToolCall } from '@shared/types/ai.types'

interface ToolCallDisplayProps {
  toolCall: MCPToolCall
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = {
    pending: 'text-[var(--color-text-muted)]',
    running: 'text-[var(--color-warning)]',
    success: 'text-[var(--color-success)]',
    error: 'text-[var(--color-error)]'
  }[toolCall.status]

  const statusIcon = {
    pending: '○',
    running: '◌',
    success: '✓',
    error: '✗'
  }[toolCall.status]

  return (
    <div className="my-2 mx-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] overflow-hidden">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`font-mono text-xs ${statusColor}`}>{statusIcon}</span>
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          工具调用：<span className="text-[var(--color-text-primary)] font-mono">{toolCall.name}</span>
        </span>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">输入</p>
            <pre className="text-xs text-[var(--color-text-secondary)] font-mono overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.result && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">输出</p>
              <pre className="text-xs text-[var(--color-text-secondary)] font-mono overflow-x-auto">
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`ml-auto w-3 h-3 text-[var(--color-text-muted)] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
