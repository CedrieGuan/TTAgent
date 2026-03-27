import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatMessage, MCPToolCall } from '@shared/types/ai.types'
import type { ContextEvent } from '@shared/types/context.types'

interface ChatState {
  messagesBySession: Record<string, ChatMessage[]>
  isThinking: boolean
  isStreaming: boolean
  streamingContent: string
  streamingSessionId: string | null
  streamingToolCalls: MCPToolCall[]
  contextEventsBySession: Record<string, ContextEvent[]>

  getMessages: (sessionId: string) => ChatMessage[]
  loadMessages: (sessionId: string) => Promise<void>
  addMessage: (sessionId: string, msg: ChatMessage) => void
  startThinking: (sessionId: string) => void
  appendStreamChunk: (sessionId: string, text: string) => void
  addStreamingToolCall: (sessionId: string, toolCall: MCPToolCall) => void
  updateStreamingToolCall: (
    sessionId: string,
    toolCallId: string,
    updates: Partial<MCPToolCall>
  ) => void
  finalizeStream: (sessionId: string) => void
  resetStreamingState: (sessionId: string) => void
  clearMessages: (sessionId: string) => Promise<void>
  addContextEvent: (sessionId: string, event: ContextEvent) => void
  clearContextEvents: (sessionId: string) => void
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    messagesBySession: {},
    isThinking: false,
    isStreaming: false,
    streamingContent: '',
    streamingSessionId: null,
    streamingToolCalls: [],
    contextEventsBySession: {},

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
        state.streamingToolCalls = []
      }),

    appendStreamChunk: (sessionId, text) =>
      set((state) => {
        state.isThinking = false
        state.isStreaming = true
        state.streamingSessionId = sessionId
        state.streamingContent += text
      }),

    addStreamingToolCall: (sessionId, toolCall) =>
      set((state) => {
        if (state.streamingSessionId !== sessionId) return
        state.streamingToolCalls.push(toolCall)
      }),

    updateStreamingToolCall: (sessionId, toolCallId, updates) =>
      set((state) => {
        if (state.streamingSessionId !== sessionId) return
        const idx = state.streamingToolCalls.findIndex((tc) => tc.id === toolCallId)
        if (idx !== -1) {
          Object.assign(state.streamingToolCalls[idx], updates)
        }
      }),

    finalizeStream: (sessionId) =>
      set((state) => {
        if (state.streamingSessionId === sessionId) {
          if (state.streamingContent) {
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
        }
        state.isThinking = false
        state.streamingContent = ''
        state.streamingSessionId = null
        state.isStreaming = false
        state.streamingToolCalls = []
      }),

    resetStreamingState: (sessionId) =>
      set((state) => {
        if (state.streamingSessionId === sessionId) {
          state.streamingContent = ''
          state.streamingToolCalls = []
          state.isThinking = true
          state.isStreaming = false
        }
      }),

    clearMessages: async (sessionId) => {
      await window.api.clearSessionMessages(sessionId)
      set((state) => {
        state.messagesBySession[sessionId] = []
      })
    },

    addContextEvent: (sessionId, event) =>
      set((state) => {
        if (!state.contextEventsBySession[sessionId]) {
          state.contextEventsBySession[sessionId] = []
        }
        state.contextEventsBySession[sessionId].push(event)
      }),

    clearContextEvents: (sessionId) =>
      set((state) => {
        state.contextEventsBySession[sessionId] = []
      })
  }))
)
