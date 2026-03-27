import { create } from 'zustand'
import type { Session } from '@shared/types/session.types'

interface SessionState {
  sessions: Session[]
  currentSessionId: string | null
  loading: boolean

  loadSessions: () => Promise<void>
  createSession: (title?: string) => Promise<Session | null>
  deleteSession: (id: string) => Promise<void>
  renameSession: (id: string, title: string) => Promise<void>
  selectSession: (id: string) => void
  getCurrentSession: () => Session | undefined
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,

  loadSessions: async () => {
    set({ loading: true })
    const res = await window.api.listSessions()
    if (res.success && res.data) {
      set({ sessions: res.data })
      // 若没有当前会话，自动选中第一个
      if (!get().currentSessionId && res.data.length > 0) {
        set({ currentSessionId: res.data[0].id })
      }
    }
    set({ loading: false })
  },

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

  deleteSession: async (id) => {
    await window.api.deleteSession(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const currentSessionId =
        state.currentSessionId === id ? (sessions[0]?.id ?? null) : state.currentSessionId
      return { sessions, currentSessionId }
    })
  },

  renameSession: async (id, title) => {
    const res = await window.api.updateSession({ id, title })
    if (res.success && res.data) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? res.data! : s))
      }))
    }
  },

  selectSession: (id) => set({ currentSessionId: id }),

  getCurrentSession: () => {
    const { sessions, currentSessionId } = get()
    return sessions.find((s) => s.id === currentSessionId)
  }
}))
