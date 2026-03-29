import React, { useEffect, useRef } from 'react'
import type { ChatMessage, MCPToolCall } from '@shared/types/ai.types'
import type { ContextEvent } from '@shared/types/context.types'
import type { MemoryEvent } from '@shared/types/memory.types'
import type { PendingConfirm } from '@stores/chat.store'
import { MessageBubble, StreamingBubble } from './MessageBubble'
import { ToolCallDisplay } from './ToolCallDisplay'
import { ToolConfirmPill } from './ToolConfirmPill'
import { ContextEventPill } from './ContextEventPill'
import { MemoryEventPill } from './MemoryEventPill'

interface MessageListProps {
  messages: ChatMessage[]
  isThinking: boolean
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: MCPToolCall[]
  contextEvents: ContextEvent[]
  memoryEvents: MemoryEvent[]
  sessionId: string
  pendingConfirms: PendingConfirm[]
  onConfirmRespond: (confirmId: string, response: 'allow' | 'reject' | 'always_allow') => void
}

export function MessageList({
  messages,
  isThinking,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  contextEvents,
  memoryEvents,
  sessionId,
  pendingConfirms,
  onConfirmRespond
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [
    messages.length,
    streamingContent,
    isThinking,
    streamingToolCalls.length,
    contextEvents.length,
    memoryEvents.length,
    pendingConfirms.length
  ])

  if (messages.length === 0 && !isStreaming && !isThinking) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-4xl">✦</div>
          <p className="text-sm text-[var(--color-text-muted)]">发送消息开始对话</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {pendingConfirms.map((confirm) => (
        <ToolConfirmPill
          key={confirm.confirmId}
          confirm={confirm}
          sessionId={sessionId}
          onRespond={onConfirmRespond}
        />
      ))}

      {streamingToolCalls.map((tc) => (
        <ToolCallDisplay key={tc.id} toolCall={tc} />
      ))}

      {(isThinking || isStreaming) && (
        <StreamingBubble content={streamingContent} isThinking={isThinking} />
      )}

      {(contextEvents.length > 0 || memoryEvents.length > 0) && (
        <div className="flex flex-col gap-1 px-6 pt-2">
          {contextEvents
            .filter((evt) => evt.type !== 'context_budget_info')
            .map((evt, i) => (
              <ContextEventPill key={`${evt.type}-${evt.timestamp}-${i}`} event={evt} />
            ))}
          {memoryEvents
            .filter((evt) => evt.type !== 'memory_extraction_started')
            .map((evt, i) => (
              <MemoryEventPill key={`${evt.type}-${evt.timestamp}-${i}`} event={evt} />
            ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
