import { useCallback } from 'react'
import { useChatStore } from '@stores/chat.store'
import { useSessionStore } from '@stores/session.store'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import { useSkillStore } from '@stores/skill.store'
import type { ChatMessage, Attachment } from '@shared/types/ai.types'
import type { AIRequestPayload } from '@shared/types/ipc.types'
import type { AgentSkill } from '@shared/types/skill.types'

export function useChat() {
  const {
    addMessage,
    getMessages,
    isThinking,
    isStreaming,
    streamingContent,
    streamingSessionId,
    streamingToolCalls,
    startThinking
  } = useChatStore()
  const { currentSessionId, getCurrentSession } = useSessionStore()
  const { providers, agentSystemPrompt } = useSettingsStore()
  const { allTools, toolsEnabled } = useAgentStore()
  const { getEnabledSkills } = useSkillStore()

  const messages = currentSessionId ? getMessages(currentSessionId) : []
  const isActiveSession = streamingSessionId === currentSessionId
  const currentStreamingContent = isActiveSession ? streamingContent : ''
  const currentIsStreaming = isStreaming && isActiveSession
  const currentIsThinking = isThinking && isActiveSession

  const sendMessage = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (!currentSessionId || (isStreaming && isActiveSession)) return
      if (!text.trim() && (!attachments || attachments.length === 0)) return

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
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        timestamp: Date.now()
      }
      addMessage(currentSessionId, userMsg)

      // 标记为思考中
      startThinking(currentSessionId)

      // 构建发送给 AI 的消息列表
      const allMessages = [...getMessages(currentSessionId)]

      const payload: AIRequestPayload = {
        sessionId: currentSessionId,
        messages: allMessages,
        provider: session.provider,
        model: session.model,
        systemPrompt: buildSystemPrompt(
          session.systemPrompt ?? agentSystemPrompt,
          getEnabledSkills()
        ),
        mcpTools: toolsEnabled ? allTools : undefined
      }

      await window.api.sendMessage(payload)
    },
    [
      currentSessionId,
      isStreaming,
      isActiveSession,
      getCurrentSession,
      providers,
      agentSystemPrompt,
      allTools,
      toolsEnabled,
      getEnabledSkills,
      addMessage,
      getMessages,
      startThinking
    ]
  )

  const cancelStream = useCallback(() => {
    if (currentSessionId && (currentIsStreaming || currentIsThinking)) {
      window.api.cancelStream(currentSessionId)
    }
  }, [currentSessionId, currentIsStreaming, currentIsThinking])

  return {
    messages,
    isThinking: currentIsThinking,
    isStreaming: currentIsStreaming,
    streamingContent: currentStreamingContent,
    streamingToolCalls: isActiveSession ? streamingToolCalls : [],
    sendMessage,
    cancelStream
  }
}

function buildSystemPrompt(basePrompt: string, enabledSkills: AgentSkill[]): string {
  if (enabledSkills.length === 0) return basePrompt
  const skillSections = enabledSkills.map(
    (skill) => `## Skill: ${skill.name}\n${skill.instructions}`
  )
  return `${basePrompt}\n\n# Active Skills\n\n${skillSections.join('\n\n')}`
}
