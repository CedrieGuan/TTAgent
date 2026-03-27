import React from 'react'
import type { ChatMessage } from '@shared/types/ai.types'
import { formatTime } from '@lib/utils'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 px-6 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* 头像 */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${isUser
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* 消息内容 */}
      <div className={`flex max-w-[75%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
            ${isUser
              ? 'bg-[var(--color-accent)] text-white rounded-tr-sm'
              : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-tl-sm'
            }
            ${message.isError ? 'border-[var(--color-error)] text-[var(--color-error)]' : ''}`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

/** 流式输出时显示的"正在打字"气泡 */
export function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 px-6 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface-2)] text-xs font-bold text-[var(--color-text-secondary)] border border-[var(--color-border)]">
        AI
      </div>
      <div className="flex max-w-[75%] flex-col gap-1 items-start">
        <div className="rounded-xl rounded-tl-sm bg-[var(--color-bg-surface-2)] border border-[var(--color-border)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
          {content || (
            <span className="flex gap-1 items-center">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </span>
          )}
          {content && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--color-accent)] align-middle" />}
        </div>
      </div>
    </div>
  )
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce"
      style={{ animationDelay: `${delay}s` }}
    />
  )
}
