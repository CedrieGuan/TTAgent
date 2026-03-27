import { encodingForModel as encoding_for_model } from 'js-tiktoken'
import type { ChatMessage } from '@shared/types/ai.types'
import type { TokenBudget } from '@shared/types/context.types'

let encoder: ReturnType<typeof encoding_for_model> | undefined

function getEncoder() {
  if (!encoder) {
    encoder = encoding_for_model('gpt-4o')
  }

  return encoder
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

function countTokens(value: string) {
  if (!value) return 0
  return getEncoder().encode(value).length
}

export function countTextTokens(text: string): number {
  return countTokens(text)
}

export function estimateSystemPromptTokens(systemPrompt: string | undefined): number {
  if (!systemPrompt) return 0
  return countTokens(systemPrompt) + 4
}

export function estimateToolSchemaTokens(toolCount: number): number {
  return toolCount > 0 ? toolCount * 250 : 0
}

export function countMessageTokens(message: ChatMessage): number {
  const anthropicToolResults = (
    message as ChatMessage & {
      _anthropicToolResults?: { output: string }[]
    }
  )._anthropicToolResults

  if (anthropicToolResults?.length) {
    return anthropicToolResults.reduce((total, result) => total + countTokens(result.output), 0)
  }

  const isToolMessage =
    message.role === 'tool' ||
    Boolean((message as ChatMessage & { _toolCallId?: string })._toolCallId)
  let total = isToolMessage ? 0 : 4

  total += countTokens(message.content)

  if (message.attachments?.length) {
    for (const attachment of message.attachments) {
      if (attachment.type === 'image') {
        total += 1000
      } else {
        total += countTokens(attachment.data)
      }
    }
  }

  if (message.toolCalls?.length) {
    for (const toolCall of message.toolCalls) {
      total += countTokens(toolCall.name)
      total += countTokens(safeStringify(toolCall.input))
    }
  }

  return total
}

export function countMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + countMessageTokens(message), 3)
}

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
