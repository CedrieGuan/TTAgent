/**
 * 聊天 Store
 * 管理消息列表、流式响应状态和上下文事件
 * 使用 immer 中间件支持不可变状态更新
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatMessage, MCPToolCall } from '@shared/types/ai.types'
import type { ContextEvent } from '@shared/types/context.types'

/** 待用户确认的危险工具请求 */
export interface PendingConfirm {
  confirmId: string
  toolName: string
  toolInput: Record<string, unknown>
}

interface ChatState {
  /** 按 sessionId 分组的消息列表 */
  messagesBySession: Record<string, ChatMessage[]>
  /** 是否处于"思考中"状态（已发送请求，等待第一个 token） */
  isThinking: boolean
  /** 是否正在接收流式响应 */
  isStreaming: boolean
  /** 当前正在累积的流式文本内容 */
  streamingContent: string
  /** 当前正在流式响应的会话 ID */
  streamingSessionId: string | null
  /** 当前流式响应中的工具调用列表（实时更新） */
  streamingToolCalls: MCPToolCall[]
  /** 按 sessionId 分组的上下文管理事件 */
  contextEventsBySession: Record<string, ContextEvent[]>
  /** 按 sessionId 分组的待确认工具请求 */
  pendingConfirmsBySession: Record<string, PendingConfirm[]>

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
  /** 添加一条待确认的工具请求 */
  addPendingConfirm: (sessionId: string, confirm: PendingConfirm) => void
  /** 移除指定的待确认请求 */
  removePendingConfirm: (sessionId: string, confirmId: string) => void
  /** 清空指定会话的所有待确认请求（流取消时调用） */
  clearPendingConfirms: (sessionId: string) => void
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
    pendingConfirmsBySession: {},

    /** 获取指定会话的消息列表（不存在则返回空数组） */
    getMessages: (sessionId) => get().messagesBySession[sessionId] ?? [],

    /** 从主进程加载指定会话的历史消息 */
    loadMessages: async (sessionId) => {
      const res = await window.api.getSessionMessages(sessionId)
      if (res.success && res.data) {
        set((state) => {
          state.messagesBySession[sessionId] = res.data as ChatMessage[]
        })
      }
    },

    /** 向指定会话追加一条消息 */
    addMessage: (sessionId, msg) =>
      set((state) => {
        if (!state.messagesBySession[sessionId]) {
          state.messagesBySession[sessionId] = []
        }
        state.messagesBySession[sessionId].push(msg)
      }),

    /** 标记为"思考中"状态，重置流式相关状态 */
    startThinking: (sessionId) =>
      set((state) => {
        state.isThinking = true
        state.isStreaming = false
        state.streamingContent = ''
        state.streamingSessionId = sessionId
        state.streamingToolCalls = []
      }),

    /** 追加流式文本块，切换到"流式中"状态 */
    appendStreamChunk: (sessionId, text) =>
      set((state) => {
        state.isThinking = false
        state.isStreaming = true
        state.streamingSessionId = sessionId
        state.streamingContent += text
      }),

    /** 添加一个新的流式工具调用 */
    addStreamingToolCall: (sessionId, toolCall) =>
      set((state) => {
        if (state.streamingSessionId !== sessionId) return
        state.streamingToolCalls.push(toolCall)
      }),

    /** 更新指定工具调用的状态（如执行结果） */
    updateStreamingToolCall: (sessionId, toolCallId, updates) =>
      set((state) => {
        if (state.streamingSessionId !== sessionId) return
        const idx = state.streamingToolCalls.findIndex((tc) => tc.id === toolCallId)
        if (idx !== -1) {
          Object.assign(state.streamingToolCalls[idx], updates)
        }
      }),

    /**
     * 完成流式响应：将累积的文本内容保存为 assistant 消息，重置流式状态
     */
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

    /**
     * 重置流式状态（用于 Agent Loop 中间轮次：工具调用完成后准备下一轮）
     * 保留 isThinking = true，等待下一轮 LLM 响应
     */
    resetStreamingState: (sessionId) =>
      set((state) => {
        if (state.streamingSessionId === sessionId) {
          state.streamingContent = ''
          state.streamingToolCalls = []
          state.isThinking = true
          state.isStreaming = false
        }
      }),

    /** 清空指定会话的所有消息（同时调用主进程持久化清空） */
    clearMessages: async (sessionId) => {
      await window.api.clearSessionMessages(sessionId)
      set((state) => {
        state.messagesBySession[sessionId] = []
      })
    },

    /** 添加上下文管理事件（用于 UI 展示 token 使用情况） */
    addContextEvent: (sessionId, event) =>
      set((state) => {
        if (!state.contextEventsBySession[sessionId]) {
          state.contextEventsBySession[sessionId] = []
        }
        state.contextEventsBySession[sessionId].push(event)
      }),

    /** 清空指定会话的上下文事件列表 */
    clearContextEvents: (sessionId) =>
      set((state) => {
        state.contextEventsBySession[sessionId] = []
      }),

    /** 添加一条待确认的工具请求 */
    addPendingConfirm: (sessionId, confirm) =>
      set((state) => {
        if (!state.pendingConfirmsBySession[sessionId]) {
          state.pendingConfirmsBySession[sessionId] = []
        }
        state.pendingConfirmsBySession[sessionId].push(confirm)
      }),

    /** 移除已响应的待确认请求 */
    removePendingConfirm: (sessionId, confirmId) =>
      set((state) => {
        const list = state.pendingConfirmsBySession[sessionId]
        if (list) {
          state.pendingConfirmsBySession[sessionId] = list.filter(
            (c) => c.confirmId !== confirmId
          )
        }
      }),

    /** 清空指定会话的所有待确认请求（流取消时调用） */
    clearPendingConfirms: (sessionId) =>
      set((state) => {
        state.pendingConfirmsBySession[sessionId] = []
      })
  }))
)
