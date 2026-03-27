/**
 * useChat Hook
 * 封装发送消息和取消流式响应的核心逻辑
 * 负责构建 AI 请求载荷（包含系统提示、技能注入和工具列表）
 */
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
  // 仅当流式响应属于当前会话时才展示
  const isActiveSession = streamingSessionId === currentSessionId
  const currentStreamingContent = isActiveSession ? streamingContent : ''
  const currentIsStreaming = isStreaming && isActiveSession
  const currentIsThinking = isThinking && isActiveSession

  /**
   * 发送消息
   * 1. 乐观更新：立即将用户消息显示在 UI
   * 2. 标记为思考中
   * 3. 构建请求载荷（含技能注入的系统提示）
   * 4. 调用主进程 IPC 发送请求
   */
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

      // 标记为思考中，显示加载状态
      startThinking(currentSessionId)

      // 构建包含最新用户消息的完整消息列表
      const allMessages = [...getMessages(currentSessionId)]

      const payload: AIRequestPayload = {
        sessionId: currentSessionId,
        messages: allMessages,
        provider: session.provider,
        model: session.model,
        // 将启用的技能注入到系统提示中
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

  /** 取消当前会话的流式响应 */
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

/**
 * 构建最终的系统提示
 * 将启用的技能指令以 Markdown 格式追加到基础系统提示后
 */
function buildSystemPrompt(basePrompt: string, enabledSkills: AgentSkill[]): string {
  if (enabledSkills.length === 0) return basePrompt
  const skillSections = enabledSkills.map(
    (skill) => `## Skill: ${skill.name}\n${skill.instructions}`
  )
  return `${basePrompt}\n\n# Active Skills\n\n${skillSections.join('\n\n')}`
}
