import type { AIProvider, ChatMessage } from './ai.types'

export interface Session {
  id: string
  title: string
  provider: AIProvider
  model: string
  systemPrompt?: string
  createdAt: number
  updatedAt: number
  messageCount: number
  lastMessage?: string
}

export interface SessionWithMessages extends Session {
  messages: ChatMessage[]
}
