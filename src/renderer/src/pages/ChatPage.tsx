import React, { useEffect } from 'react'
import { MessageList } from '@components/chat/MessageList'
import { InputArea } from '@components/chat/InputArea'
import { useChat } from '@hooks/useChat'
import { useChatStore } from '@stores/chat.store'
import { useSessionStore } from '@stores/session.store'

export function ChatPage() {
  const { messages, isStreaming, streamingContent, sendMessage, cancelStream } = useChat()
  const { loadMessages } = useChatStore()
  const { currentSessionId, getCurrentSession } = useSessionStore()

  // 切换会话时加载历史消息
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId)
    }
  }, [currentSessionId, loadMessages])

  const session = getCurrentSession()

  if (!currentSessionId) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-text-muted)] text-sm">
        请在左侧创建或选择一个对话
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 顶部会话信息栏 */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-6 py-2.5">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {session?.title ?? '对话'}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {session?.model}
        </span>
      </div>

      {/* 消息列表 */}
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
      />

      {/* 输入区域 */}
      <InputArea
        onSend={sendMessage}
        onCancel={cancelStream}
        isStreaming={isStreaming}
      />
    </div>
  )
}
