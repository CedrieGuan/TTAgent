import React, { useEffect, useRef } from 'react'
import type { ChatMessage } from '@shared/types/ai.types'
import { MessageBubble, StreamingBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
}

export function MessageList({ messages, isStreaming, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  if (messages.length === 0 && !isStreaming) {
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
      {isStreaming && <StreamingBubble content={streamingContent} />}
      <div ref={bottomRef} />
    </div>
  )
}
