import React from 'react'
import type { ChatMessage, Attachment } from '@shared/types/ai.types'
import { formatTime } from '@lib/utils'
import { ToolCallDisplay } from './ToolCallDisplay'

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
          ${
            isUser
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
      >
        {isUser ? 'U' : 'AI'}
      </div>

      {/* 消息内容 */}
      <div className={`flex max-w-[75%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* 附件预览 */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.attachments.map((att, i) => (
              <AttachmentPreview key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* 文本内容 */}
        {message.content && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
              ${
                isUser
                  ? 'bg-[var(--color-accent)] text-white rounded-tr-sm'
                  : 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-tl-sm'
              }
              ${message.isError ? 'border-[var(--color-error)] text-[var(--color-error)]' : ''}`}
          >
            {message.content}
          </div>
        )}

        {/* 工具调用 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1">
            {message.toolCalls.map((tc) => (
              <ToolCallDisplay key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <div className="relative rounded-lg overflow-hidden border border-[var(--color-border)] max-w-[200px]">
        <img
          src={`data:${attachment.mimeType};base64,${attachment.data}`}
          alt={attachment.name}
          className="max-h-[160px] object-contain"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5 text-[10px] text-white truncate">
          {attachment.name}
        </div>
      </div>
    )
  }

  // 文件附件
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 py-2">
      <FileIcon mimeType={attachment.mimeType} />
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-[var(--color-text-primary)] truncate max-w-[140px]">
          {attachment.name}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {formatFileSize(attachment.size)}
        </span>
      </div>
    </div>
  )
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isText = mimeType.startsWith('text/')
  const isPdf = mimeType === 'application/pdf'

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`shrink-0 ${isPdf ? 'text-red-400' : isText ? 'text-blue-400' : 'text-[var(--color-text-muted)]'}`}
    >
      {isPdf ? (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="15" x2="15" y2="15" />
          <line x1="9" y1="11" x2="11" y2="11" />
        </>
      ) : (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </>
      )}
    </svg>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 流式输出时显示的气泡（思考中 + 打字中） */
export function StreamingBubble({ content, isThinking }: { content: string; isThinking: boolean }) {
  return (
    <div className="flex gap-3 px-6 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-surface-2)] text-xs font-bold text-[var(--color-text-secondary)] border border-[var(--color-border)]">
        AI
      </div>
      <div className="flex max-w-[75%] flex-col gap-1 items-start">
        <div className="rounded-xl rounded-tl-sm bg-[var(--color-bg-surface-2)] border border-[var(--color-border)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
          {isThinking && !content ? (
            <span className="flex gap-1.5 items-center text-[var(--color-text-muted)]">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
              <span className="ml-1 text-xs">思考中...</span>
            </span>
          ) : content ? (
            <>
              {content}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--color-accent)] align-middle" />
            </>
          ) : (
            <span className="flex gap-1 items-center">
              <Dot delay={0} />
              <Dot delay={0.15} />
              <Dot delay={0.3} />
            </span>
          )}
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
