/**
 * Token 计数模块
 * 使用 tiktoken 对消息进行 token 估算，用于上下文预算管理
 */
import { encodingForModel as encoding_for_model } from 'js-tiktoken'
import type { ChatMessage } from '@shared/types/ai.types'
import type { TokenBudget } from '@shared/types/context.types'

// 复用同一个编码器实例，避免重复初始化开销
let encoder: ReturnType<typeof encoding_for_model> | undefined

function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model('gpt-4o')
  }
  return encoder
}

/** 安全地将任意值序列化为字符串 */
function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

/** 计算字符串的 token 数 */
function countTokens(value: string) {
  if (!value) return 0
  return getEncoder().encode(value).length
}

/** 计算纯文本的 token 数（对外暴露） */
export function countTextTokens(text: string): number {
  return countTokens(text)
}

/** 估算系统提示的 token 数（含固定开销 4 token） */
export function estimateSystemPromptTokens(systemPrompt: string | undefined): number {
  if (!systemPrompt) return 0
  return countTokens(systemPrompt) + 4
}

/**
 * 估算工具定义的 token 开销
 * 每个工具约占 250 token（包含名称、描述、参数 schema）
 */
export function estimateToolSchemaTokens(toolCount: number): number {
  return toolCount > 0 ? toolCount * 250 : 0
}

/** 计算单条消息的 token 数 */
export function countMessageTokens(message: ChatMessage): number {
  // Anthropic 工具结果消息（user 角色中包含 tool_result 块）
  const anthropicToolResults = (
    message as ChatMessage & {
      _anthropicToolResults?: { output: string }[]
    }
  )._anthropicToolResults

  if (anthropicToolResults?.length) {
    return anthropicToolResults.reduce((total, result) => total + countTokens(result.output), 0)
  }

  // tool 角色消息不计入固定开销
  const isToolMessage =
    message.role === 'tool' ||
    Boolean((message as ChatMessage & { _toolCallId?: string })._toolCallId)
  let total = isToolMessage ? 0 : 4 // 每条普通消息固定 4 token 开销

  total += countTokens(message.content)

  // 附件：图片按 1000 token 估算，文本文件按实际内容计算
  if (message.attachments?.length) {
    for (const attachment of message.attachments) {
      if (attachment.type === 'image') {
        total += 1000
      } else {
        total += countTokens(attachment.data)
      }
    }
  }

  // 工具调用参数
  if (message.toolCalls?.length) {
    for (const toolCall of message.toolCalls) {
      total += countTokens(toolCall.name)
      total += countTokens(safeStringify(toolCall.input))
    }
  }

  return total
}

/** 计算消息列表的总 token 数（含 3 token 的对话固定开销） */
export function countMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + countMessageTokens(message), 3)
}

/**
 * 计算上下文 Token 预算分配
 * @param contextWindow 模型总上下文窗口
 * @param maxTokens 为响应预留的最大 token 数
 * @param hasTools 是否启用工具调用（影响 agent 循环预留量）
 */
export function calculateBudget(
  contextWindow: number,
  maxTokens: number,
  hasTools: boolean
): TokenBudget {
  const responseReserve = maxTokens
  const safetyMargin = 8000
  const agentLoopHeadroom = hasTools ? 8000 : 2000
  const usableInputBudget = contextWindow - responseReserve - safetyMargin - agentLoopHeadroom

  return {
    totalContextWindow: contextWindow,
    responseReserve,
    safetyMargin,
    agentLoopHeadroom,
    usableInputBudget
  }
}
