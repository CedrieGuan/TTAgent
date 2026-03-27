/**
 * 对话轮次解析模块
 * 将扁平的 ChatMessage[] 按用户消息边界切分为 ConversationTurn[]
 * 轮次是上下文管理策略的基本操作单元
 */
import type { ChatMessage } from '@shared/types/ai.types'
import type { ConversationTurn } from '@shared/types/context.types'

/** 判断消息是否包含 Anthropic 格式的工具结果（user 角色中的 tool_result 块） */
function hasAnthropicToolResults(message: ChatMessage) {
  return Boolean((message as unknown as Record<string, unknown>)._anthropicToolResults)
}

/** 判断是否为真实的用户消息（排除 Anthropic 工具结果伪装的 user 消息） */
function isRealUserMessage(message: ChatMessage) {
  return message.role === 'user' && !hasAnthropicToolResults(message)
}

/** 判断消息是否属于工具调用链（工具调用、工具结果） */
function hasToolChainMessage(message: ChatMessage) {
  return Boolean(
    message.toolCalls?.length || message.role === 'tool' || hasAnthropicToolResults(message)
  )
}

/** 构建一个 ConversationTurn 对象 */
function buildTurn(
  id: string,
  messages: ChatMessage[],
  startIndex: number,
  endIndex: number
): ConversationTurn {
  return {
    id,
    startIndex,
    endIndex,
    messages,
    hasToolChain: messages.some(hasToolChainMessage),
    tokenEstimate: 0, // 由调用方填充
    isCurrentTurn: false
  }
}

/**
 * 将消息列表解析为对话轮次数组
 * - 每个真实用户消息开启一个新轮次
 * - system 消息被跳过
 * - 最后一个轮次标记为 isCurrentTurn = true
 */
export function deriveTurns(messages: ChatMessage[]): ConversationTurn[] {
  if (messages.length === 0) return []

  const turns: ConversationTurn[] = []
  let turnMessages: ChatMessage[] = []
  let turnStartIndex = -1
  let turnId = ''
  let seenRealUser = false
  // 在遇到第一条真实用户消息之前的消息（如 assistant 开场白）
  const preludeMessages: ChatMessage[] = []
  let preludeStartIndex = -1

  /** 将当前积累的消息刷入 turns 数组 */
  const flushTurn = (endIndex: number) => {
    if (turnMessages.length === 0) return
    turns.push(buildTurn(turnId, turnMessages, turnStartIndex, endIndex))
    turnMessages = []
    turnStartIndex = -1
    turnId = ''
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!

    // 跳过 system 消息
    if (message.role === 'system') {
      continue
    }

    if (isRealUserMessage(message)) {
      if (!seenRealUser) {
        // 第一条用户消息：将前置消息合并进第一个轮次
        seenRealUser = true
        turnMessages = [...preludeMessages, message]
        turnStartIndex = preludeStartIndex === -1 ? index : preludeStartIndex
        turnId = message.id
        preludeMessages.length = 0
      } else {
        // 后续用户消息：结束上一轮次，开启新轮次
        flushTurn(index - 1)
        turnMessages = [message]
        turnStartIndex = index
        turnId = message.id
      }
      continue
    }

    if (!seenRealUser) {
      // 尚未遇到用户消息，暂存为前置消息
      if (preludeStartIndex === -1) {
        preludeStartIndex = index
      }
      preludeMessages.push(message)
      continue
    }

    // 普通 assistant / tool 消息，追加到当前轮次
    if (turnMessages.length === 0) {
      turnStartIndex = index
      turnId = message.id
    }
    turnMessages.push(message)
  }

  // 刷入最后一个轮次
  if (turnMessages.length > 0) {
    turns.push(buildTurn(turnId, turnMessages, turnStartIndex, messages.length - 1))
  }

  // 如果没有解析出任何轮次（全是 system 消息或无用户消息），将所有非 system 消息作为一个轮次
  if (turns.length === 0) {
    const nonSystemMessages = messages.filter((message) => message.role !== 'system')
    if (nonSystemMessages.length === 0) return []

    const firstNonSystemIndex = messages.findIndex((message) => message.role !== 'system')
    turns.push(
      buildTurn(
        nonSystemMessages[0]!.id,
        nonSystemMessages,
        firstNonSystemIndex === -1 ? 0 : firstNonSystemIndex,
        messages.length - 1
      )
    )
  }

  // 最后一个轮次标记为当前轮次（受保护，不会被截断）
  turns[turns.length - 1]!.isCurrentTurn = true

  return turns
}

/** 将轮次数组展平为消息列表 */
export function flattenTurns(turns: ConversationTurn[]): ChatMessage[] {
  return turns.flatMap((turn) => turn.messages)
}
