import React, { useState } from 'react'
import type { PendingConfirm } from '@stores/chat.store'

interface ToolConfirmPillProps {
  confirm: PendingConfirm
  sessionId: string
  onRespond: (confirmId: string, response: 'allow' | 'reject' | 'always_allow') => void
}

/** 将工具名称格式化为可读形式（去掉 local_ 前缀，下划线转空格） */
function formatToolName(name: string): string {
  return name.replace(/^local_/, '').replace(/_/g, ' ')
}

/** 将工具输入参数渲染为可读的行列表 */
function renderInputLines(input: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(input).map(([key, value]) => ({
    key,
    value:
      typeof value === 'string'
        ? value.length > 200
          ? value.slice(0, 200) + '…'
          : value
        : JSON.stringify(value)
  }))
}

export function ToolConfirmPill({ confirm, onRespond }: ToolConfirmPillProps) {
  const [responded, setResponded] = useState(false)

  const handleRespond = (response: 'allow' | 'reject' | 'always_allow') => {
    if (responded) return
    setResponded(true)
    onRespond(confirm.confirmId, response)
  }

  const inputLines = renderInputLines(confirm.toolInput)

  return (
    <div className="mx-4 my-2 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/20">
        <ShieldIcon />
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
          需要确认
        </span>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">
          {formatToolName(confirm.toolName)}
        </span>
      </div>

      {inputLines.length > 0 && (
        <div className="px-4 py-2 font-mono text-[11px] text-[var(--color-text-secondary)] space-y-0.5 max-h-32 overflow-y-auto">
          {inputLines.map(({ key, value }) => (
            <div key={key} className="flex gap-2 min-w-0">
              <span className="text-[var(--color-text-muted)] shrink-0">{key}:</span>
              <span className="truncate">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-amber-500/20">
        <button
          onClick={() => handleRespond('allow')}
          disabled={responded}
          className="px-3 py-1 rounded-md text-xs font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          允许
        </button>
        <button
          onClick={() => handleRespond('always_allow')}
          disabled={responded}
          className="px-3 py-1 rounded-md text-xs font-medium bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-3)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          始终允许
        </button>
        <button
          onClick={() => handleRespond('reject')}
          disabled={responded}
          className="ml-auto px-3 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          拒绝
        </button>
      </div>
    </div>
  )
}

const ShieldIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="text-amber-400"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
