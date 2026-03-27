import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatMessage } from '@shared/types/ai.types'

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>
  isThinking: boolean
  isStreaming: boolean
  streamingContent: string
  streamingSessionId: string | null

  // 获取当前会话消息
  getMessages: (sessionId: string) => ChatMessage[]
  // 从持久化加载消息
  loadMessages: (sessionId: string) => Promise<void>
  // 添加用户消息（发送前乐观更新）
  addMessage: (sessionId: string, msg: ChatMessage) => void
  // 开始思考（消息已发送，等待第一个流块）
  startThinking: (sessionId: string) => void
  // 流式追加文本
  appendStreamChunk: (sessionId: string, text: string) => void
  // 流结束，将 streamingContent 写入 messages
  finalizeStream: (sessionId: string) => void
  // 清空会话消息
  clearMessages: (sessionId: string) => Promise<void>
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messagesBySession: {},
    isThinking: false,
    isStreaming: false,
    streamingContent: '',
    streamingSessionId: null,

    getMessages: (sessionId) => get().messagesBySession[sessionId] ?? [],

    loadMessages: async (sessionId) => {
      const res = await window.api.getSessionMessages(sessionId)
      if (res.success && res.data) {
        set((state) => {
          state.messagesBySession[sessionId] = res.data as ChatMessage[]
        })
      }
    },

    addMessage: (sessionId, msg) =>
      set((state) => {
        if (!state.messagesBySession[sessionId]) {
          state.messagesBySession[sessionId] = []
        }
        state.messagesBySession[sessionId].push(msg)
      }),

    startThinking: (sessionId) =>
      set((state) => {
        state.isThinking = true
        state.isStreaming = false
        state.streamingContent = ''
        state.streamingSessionId = sessionId
      }),

    appendStreamChunk: (sessionId, text) =>
      set((state) => {
        state.isThinking = false
        state.isStreaming = true
        state.streamingSessionId = sessionId
        state.streamingContent += text
      }),

    finalizeStream: (sessionId) =>
      set((state) => {
        if (state.streamingContent && state.streamingSessionId === sessionId) {
          if (!state.messagesBySession[sessionId]) {
            state.messagesBySession[sessionId] = []
          }
          state.messagesBySession[sessionId].push({
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: state.streamingContent,
            timestamp: Date.now()
          })
        }
        state.isThinking = false
        state.streamingContent = ''
        state.streamingSessionId = null
        state.isStreaming = false
      }),

    clearMessages: async (sessionId) => {
      await window.api.clearSessionMessages(sessionId)
      set((state) => {
        state.messagesBySession[sessionId] = []
      })
    }
  }))
)
