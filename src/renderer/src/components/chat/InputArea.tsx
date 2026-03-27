import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@components/ui/Button'
import { useSettingsStore } from '@stores/settings.store'

interface InputAreaProps {
  onSend: (text: string) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function InputArea({ onSend, onCancel, isStreaming, disabled }: InputAreaProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { settings } = useSettingsStore()

  const handleSend = useCallback(() => {
    const text = value.trim()
    if (!text || isStreaming || disabled) return
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSend(text)
  }, [value, isStreaming, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.sendOnEnter) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    } else {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // 自动调整高度
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  const hint = settings.sendOnEnter ? 'Enter 发送，Shift+Enter 换行' : 'Cmd/Ctrl+Enter 发送'

  return (
    <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex gap-3 items-end rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2.5 focus-within:border-[var(--color-accent)] transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="发送消息..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none leading-relaxed max-h-[200px] no-drag"
          style={{ minHeight: '24px' }}
        />
        <div className="flex items-center gap-2 shrink-0">
          {isStreaming ? (
            <Button variant="danger" size="sm" onClick={onCancel}>
              <StopIcon />
              停止
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
            >
              <SendIcon />
              发送
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  )
}

const SendIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)
