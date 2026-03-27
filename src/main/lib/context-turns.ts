import type { ChatMessage } from '@shared/types/ai.types'
import type { ConversationTurn } from '@shared/types/context.types'

function hasAnthropicToolResults(message: ChatMessage) {
  return Boolean((message as unknown as Record<string, unknown>)._anthropicToolResults)
}

function isRealUserMessage(message: ChatMessage) {
  return message.role === 'user' && !hasAnthropicToolResults(message)
}

function hasToolChainMessage(message: ChatMessage) {
  return Boolean(
    message.toolCalls?.length || message.role === 'tool' || hasAnthropicToolResults(message)
  )
}

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
    tokenEstimate: 0,
    isCurrentTurn: false
  }
}

export function deriveTurns(messages: ChatMessage[]): ConversationTurn[] {
  if (messages.length === 0) return []

  const turns: ConversationTurn[] = []
  let turnMessages: ChatMessage[] = []
  let turnStartIndex = -1
  let turnId = ''
  let seenRealUser = false
  const preludeMessages: ChatMessage[] = []
  let preludeStartIndex = -1

  const flushTurn = (endIndex: number) => {
    if (turnMessages.length === 0) return
    turns.push(buildTurn(turnId, turnMessages, turnStartIndex, endIndex))
    turnMessages = []
    turnStartIndex = -1
    turnId = ''
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!

    if (message.role === 'system') {
      continue
    }

    if (isRealUserMessage(message)) {
      if (!seenRealUser) {
        seenRealUser = true
        turnMessages = [...preludeMessages, message]
        turnStartIndex = preludeStartIndex === -1 ? index : preludeStartIndex
        turnId = message.id
        preludeMessages.length = 0
      } else {
        flushTurn(index - 1)
        turnMessages = [message]
        turnStartIndex = index
        turnId = message.id
      }
      continue
    }

    if (!seenRealUser) {
      if (preludeStartIndex === -1) {
        preludeStartIndex = index
      }

      preludeMessages.push(message)
      continue
    }

    if (turnMessages.length === 0) {
      turnStartIndex = index
      turnId = message.id
    }

    turnMessages.push(message)
  }

  if (turnMessages.length > 0) {
    turns.push(buildTurn(turnId, turnMessages, turnStartIndex, messages.length - 1))
  }

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

  turns[turns.length - 1]!.isCurrentTurn = true

  return turns
}

export function flattenTurns(turns: ConversationTurn[]): ChatMessage[] {
  return turns.flatMap((turn) => turn.messages)
}
