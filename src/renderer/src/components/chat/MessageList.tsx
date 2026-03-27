import React, { useEffect, useRef } from 'react'
import type { ChatMessage, MCPToolCall } from '@shared/types/ai.types'
import type { ContextEvent } from '@shared/types/context.types'
import { MessageBubble, StreamingBubble } from './MessageBubble'
import { ToolCallDisplay } from './ToolCallDisplay'
import { ContextEventPill } from './ContextEventPill'

interface MessageListProps {
  messages: ChatMessage[]
  isThinking: boolean
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: MCPToolCall[]
  contextEvents: ContextEvent[]
}

export function MessageList({
  messages,
  isThinking,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  contextEvents
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [
    messages.length,
    streamingContent,
    isThinking,
    streamingToolCalls.length,
    contextEvents.length
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
    <div className="flex-1 overflow-y-auto py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {streamingToolCalls.map((tc) => (
        <ToolCallDisplay key={tc.id} toolCall={tc} />
      ))}

      {(isThinking || isStreaming) && (
        <StreamingBubble content={streamingContent} isThinking={isThinking} />
      )}

      {contextEvents.length > 0 && (
        <div className="flex flex-col gap-1 px-6 pt-2">
          {contextEvents
            .filter((evt) => evt.type !== 'context_budget_info')
            .map((evt, i) => (
              <ContextEventPill key={`${evt.type}-${evt.timestamp}-${i}`} event={evt} />
            ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
