import type { AIProvider, ChatMessage } from './ai.types'

/** 会话元数据 */
export interface Session {
  id: string
  title: string
  provider: AIProvider
  model: string
  /** 会话级别的系统提示（覆盖全局设置） */
  systemPrompt?: string
  createdAt: number
  updatedAt: number
  messageCount: number
  /** 最后一条消息的摘要（用于列表预览） */
  lastMessage?: string
}

/** 会话 + 完整消息列表（用于持久化存储） */
export interface SessionWithMessages extends Session {
  messages: ChatMessage[]
}
