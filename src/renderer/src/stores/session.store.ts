/**
 * 会话 Store
 * 管理会话列表、当前选中会话及会话的增删改操作
 */
import { create } from 'zustand'
import type { Session } from '@shared/types/session.types'
import type { AIProvider } from '@shared/types/ai.types'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  loading: boolean

  loadSessions: () => Promise<void>
  createSession: (title?: string) => Promise<Session | null>
  deleteSession: (id: string) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  updateModel: (id: string, provider: AIProvider, model: string) => Promise<void>
  selectSession: (id: string) => void
  getCurrentSession: () => Session | undefined
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,

  /** 从主进程加载所有会话，若无当前会话则自动选中第一个 */
  loadSessions: async () => {
    set({ loading: true })
    const res = await window.api.listSessions()
    if (res.success && res.data) {
      set({ sessions: res.data })
      if (!get().currentSessionId && res.data.length > 0) {
        set({ currentSessionId: res.data[0].id })
      }
    }
    set({ loading: false })
  },

  /** 创建新会话，并自动切换到新会话 */
  createSession: async (title) => {
    const res = await window.api.createSession({ title })
    if (res.success && res.data) {
      set((state) => ({
        sessions: [res.data!, ...state.sessions],
        currentSessionId: res.data!.id
      }))
      return res.data
    }
    return null
  },

  /** 删除会话，若删除的是当前会话则自动切换到第一个剩余会话 */
  deleteSession: async (id) => {
    await window.api.deleteSession(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const currentSessionId =
        state.currentSessionId === id ? (sessions[0]?.id ?? null) : state.currentSessionId
      return { sessions, currentSessionId }
    })
  },

  /** 重命名会话 */
  renameSession: async (id, title) => {
    const res = await window.api.updateSession({ id, title })
    if (res.success && res.data) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? res.data! : s))
      }))
    }
  },

  /** 更新会话使用的 AI 提供商和模型 */
  updateModel: async (id, provider, model) => {
    const res = await window.api.updateSession({ id, provider, model })
    if (res.success && res.data) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? res.data! : s))
      }))
    }
  },

  /** 切换当前选中的会话 */
  selectSession: (id) => set({ currentSessionId: id }),

  /** 获取当前会话对象 */
  getCurrentSession: () => {
    const { sessions, currentSessionId } = get()
    return sessions.find((s) => s.id === currentSessionId)
  }
}))
