import { useCallback } from 'react'
import { useChatStore } from '@stores/chat.store'
import { useSessionStore } from '@stores/session.store'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import type { ChatMessage } from '@shared/types/ai.types'
import type { AIRequestPayload } from '@shared/types/ipc.types'

export function useChat() {
  const { addMessage, getMessages, isStreaming, streamingContent, streamingSessionId } =
    useChatStore()
  const { currentSessionId, getCurrentSession } = useSessionStore()
  const { providers, agentSystemPrompt } = useSettingsStore()
  const { allTools, toolsEnabled } = useAgentStore()

  const messages = currentSessionId ? getMessages(currentSessionId) : []
  const currentStreamingContent =
    isStreaming && streamingSessionId === currentSessionId ? streamingContent : ''

  const sendMessage = useCallback(
    async (text: string) => {
      if (!currentSessionId || !text.trim() || isStreaming) return

      const session = getCurrentSession()
      if (!session) return

      const providerConfig = providers[session.provider]
      if (!providerConfig?.apiKey) {
        console.error('API Key not configured for provider:', session.provider)
        return
      }

      // 乐观更新：立即显示用户消息
      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        content: text,
        timestamp: Date.now()
      }
      addMessage(currentSessionId, userMsg)

      // 构建发送给 AI 的消息列表
      const allMessages = [...getMessages(currentSessionId)]

      const payload: AIRequestPayload = {
        sessionId: currentSessionId,
        messages: allMessages,
        provider: session.provider,
        model: session.model,
        systemPrompt: session.systemPrompt ?? agentSystemPrompt,
        mcpTools: toolsEnabled && allTools.length > 0 ? allTools : undefined
      }

      await window.api.sendMessage(payload)
    },
    [
      currentSessionId,
      isStreaming,
      getCurrentSession,
      providers,
      agentSystemPrompt,
      allTools,
      toolsEnabled,
      addMessage,
      getMessages
    ]
  )

  const cancelStream = useCallback(() => {
    if (currentSessionId && isStreaming) {
      window.api.cancelStream(currentSessionId)
    }
  }, [currentSessionId, isStreaming])

  return {
    messages,
    isStreaming,
    streamingContent: currentStreamingContent,
    sendMessage,
    cancelStream
  }
}
