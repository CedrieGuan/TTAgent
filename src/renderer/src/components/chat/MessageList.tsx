import React, { useEffect, useRef } from 'react'
import type { ChatMessage, MCPToolCall } from '@shared/types/ai.types'
import { MessageBubble, StreamingBubble } from './MessageBubble'
import { ToolCallDisplay } from './ToolCallDisplay'

interface MessageListProps {
  messages: ChatMessage[]
  isThinking: boolean
  isStreaming: boolean
  streamingContent: string
  streamingToolCalls: MCPToolCall[]
}

export function MessageList({
  messages,
  isThinking,
  isStreaming,
  streamingContent,
  streamingToolCalls
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent, isThinking, streamingToolCalls.length])

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
      <div ref={bottomRef} />
    </div>
  )
}
