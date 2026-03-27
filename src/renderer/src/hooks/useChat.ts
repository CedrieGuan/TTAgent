/**
 * useChat Hook
 * 封装发送消息和取消流式响应的核心逻辑
 * 负责构建 AI 请求载荷（包含系统提示、技能渐进式注入和工具列表）
 */
import { useCallback } from 'react'
import { useChatStore } from '@stores/chat.store'
import { useSessionStore } from '@stores/session.store'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import { useSkillStore } from '@stores/skill.store'
import { useMemoryStore } from '@stores/memory.store'
import type { ChatMessage, Attachment } from '@shared/types/ai.types'
import type { AIRequestPayload } from '@shared/types/ipc.types'

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
  const { getSkillSummaryPrompt, getActiveSkillInstructions, activateSkill, summaries } =
    useSkillStore()
  const { getMemoryPrompt } = useMemoryStore()

  const messages = currentSessionId ? getMessages(currentSessionId) : []
  // 仅当流式响应属于当前会话时才展示
  const isActiveSession = streamingSessionId === currentSessionId
  const currentStreamingContent = isActiveSession ? streamingContent : ''
  const currentIsStreaming = isStreaming && isActiveSession
  const currentIsThinking = isThinking && isActiveSession

  /**
   * 发送消息
   * 1. 检测斜杠命令：若消息以 /skill-name 开头，激活对应技能
   * 2. 乐观更新：立即将用户消息显示在 UI
   * 3. 标记为思考中
   * 4. 构建请求载荷（含技能渐进式注入的系统提示）
   * 5. 调用主进程 IPC 发送请求
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

      // 检测斜杠命令并激活对应技能
      let actualText = text
      let activatedSkillInfo: { name: string; description: string } | undefined
      const slashMatch = text.match(/^\/([\w-]+)\s*(.*)$/s)
      if (slashMatch) {
        const skillName = slashMatch[1]
        const remainder = slashMatch[2]

        // 查找匹配的技能
        const matched = summaries.find(
          (s) => s.name === skillName || s.id === skillName
        )
        if (matched) {
          await activateSkill(matched.id)
          activatedSkillInfo = { name: matched.name, description: matched.description }
          // 使用斜杠命令后面的文本作为实际消息；若无则提示
          actualText = remainder.trim() || `请使用 ${matched.name} 技能协助我。`
        }
      }

      // 乐观更新：立即显示用户消息
      const userMsg: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        content: actualText,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        activatedSkill: activatedSkillInfo,
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
        // 渐进式注入：基础提示 + 记忆 + 技能概览 + 已激活技能的完整指令
        systemPrompt: buildSystemPrompt(
          session.systemPrompt ?? agentSystemPrompt,
          getMemoryPrompt(),
          getSkillSummaryPrompt(),
          getActiveSkillInstructions()
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
      summaries,
      activateSkill,
      getMemoryPrompt,
      getSkillSummaryPrompt,
      getActiveSkillInstructions,
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
 * 构建最终的系统提示（渐进式加载策略）
 *
 * 层次：
 * 1. 基础系统提示
 * 2. 长期记忆（全局 + 工作区，始终附加）
 * 3. 可用技能概览（仅 name + description 摘要，始终附加）
 * 4. 已激活技能的完整指令（用户通过斜杠命令触发后才注入）
 */
function buildSystemPrompt(
  basePrompt: string,
  memoryPrompt: string,
  skillSummaryPrompt: string,
  activeInstructions: Record<string, string>
): string {
  let prompt = basePrompt

  // 附加长期记忆（全局记忆 + 工作区记忆）
  if (memoryPrompt) {
    prompt += memoryPrompt
  }

  // 附加技能概览（仅摘要，帮助 AI 知道有哪些技能可用）
  if (skillSummaryPrompt) {
    prompt += skillSummaryPrompt
  }

  // 附加已激活技能的完整指令
  const entries = Object.entries(activeInstructions)
  if (entries.length > 0) {
    prompt += '\n\n# Active Skills\n'
    for (const [name, instructions] of entries) {
      prompt += `\n## Skill: ${name}\n\n${instructions}\n`
    }
  }

  return prompt
}
