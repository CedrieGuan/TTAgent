/**
 * 记忆 Store
 * 管理全局记忆、工作区记忆、工作区路径以及记忆事件
 * 使用 immer 中间件支持不可变状态更新
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Memory, MemoryEvent } from '@shared/types/memory.types'

interface MemoryState {
  /** 全局记忆列表（跨会话） */
  globalMemories: Memory[]
  /** 当前工作区记忆列表 */
  workspaceMemories: Memory[]
  /** 当前配置的工作区路径（空字符串表示未设置） */
  workspacePath: string
  /** 按 sessionId 分组的记忆事件（用于 UI 展示） */
  memoryEventsBySession: Record<string, MemoryEvent[]>
  /** 是否已完成初始加载 */
  loaded: boolean

  /** 初始化：加载工作区路径和记忆列表 */
  loadMemories: () => Promise<void>
  /** 刷新记忆列表（记忆更新后调用） */
  refreshMemories: () => Promise<void>
  /** 设置工作区路径并重新加载记忆 */
  setWorkspacePath: (path: string) => Promise<void>
  /** 删除单条记忆 */
  deleteMemory: (scope: 'global' | 'workspace', id: string) => Promise<void>
  /** 清空记忆 */
  clearMemories: (scope: 'global' | 'workspace') => Promise<void>
  /** 添加记忆事件（来自主进程推送） */
  addMemoryEvent: (sessionId: string, event: MemoryEvent) => void
  /** 清空指定会话的记忆事件 */
  clearMemoryEvents: (sessionId: string) => void
  /** 构建记忆注入的系统提示片段 */
  getMemoryPrompt: () => string
}

export const useMemoryStore = create<MemoryState>()(
  immer((set, get) => ({
    globalMemories: [],
    workspaceMemories: [],
    workspacePath: '',
    memoryEventsBySession: {},
    loaded: false,

    /** 初始化：先加载工作区路径，再加载对应记忆 */
    loadMemories: async () => {
      const pathRes = await window.api.getMemoryWorkspacePath()
      const workspacePath = pathRes.success ? (pathRes.data ?? '') : ''

      const memRes = await window.api.getMemories(workspacePath || undefined)
      if (memRes.success && memRes.data) {
        set((state) => {
          state.workspacePath = workspacePath
          state.globalMemories = memRes.data!.global
          state.workspaceMemories = memRes.data!.workspace
          state.loaded = true
        })
      }
    },

    /** 使用当前工作区路径重新加载记忆（记忆提取完成后调用） */
    refreshMemories: async () => {
      const { workspacePath } = get()
      const res = await window.api.getMemories(workspacePath || undefined)
      if (res.success && res.data) {
        set((state) => {
          state.globalMemories = res.data!.global
          state.workspaceMemories = res.data!.workspace
        })
      }
    },

    /** 设置工作区路径，持久化并重新加载工作区记忆 */
    setWorkspacePath: async (path: string) => {
      await window.api.setMemoryWorkspacePath(path)
      const res = await window.api.getMemories(path || undefined)
      if (res.success && res.data) {
        set((state) => {
          state.workspacePath = path
          state.globalMemories = res.data!.global
          state.workspaceMemories = res.data!.workspace
        })
      }
    },

    /** 删除单条记忆并从本地状态中移除 */
    deleteMemory: async (scope, id) => {
      const { workspacePath } = get()
      await window.api.deleteMemory({
        scope,
        id,
        workspacePath: scope === 'workspace' ? workspacePath : undefined
      })
      set((state) => {
        if (scope === 'global') {
          state.globalMemories = state.globalMemories.filter((m) => m.id !== id)
        } else {
          state.workspaceMemories = state.workspaceMemories.filter((m) => m.id !== id)
        }
      })
    },

    /** 清空记忆并更新本地状态 */
    clearMemories: async (scope) => {
      const { workspacePath } = get()
      await window.api.clearMemories({
        scope,
        workspacePath: scope === 'workspace' ? workspacePath : undefined
      })
      set((state) => {
        if (scope === 'global') {
          state.globalMemories = []
        } else {
          state.workspaceMemories = []
        }
      })
    },

    /** 添加来自主进程的记忆事件 */
    addMemoryEvent: (sessionId, event) =>
      set((state) => {
        if (!state.memoryEventsBySession[sessionId]) {
          state.memoryEventsBySession[sessionId] = []
        }
        state.memoryEventsBySession[sessionId].push(event)
      }),

    /** 清空指定会话的记忆事件列表 */
    clearMemoryEvents: (sessionId) =>
      set((state) => {
        state.memoryEventsBySession[sessionId] = []
      }),

    /**
     * 构建注入系统提示的记忆片段
     * 全局记忆 + 工作区记忆（若有）
     */
    getMemoryPrompt: () => {
      const { globalMemories, workspaceMemories, workspacePath } = get()

      if (globalMemories.length === 0 && workspaceMemories.length === 0) {
        return ''
      }

      let prompt = '\n\n# Long-term Memory\n'

      if (globalMemories.length > 0) {
        prompt += '\n## About the User\n'
        for (const m of globalMemories) {
          prompt += `- ${m.content}\n`
        }
      }

      if (workspaceMemories.length > 0) {
        const wsLabel = workspacePath
          ? workspacePath.split('/').pop() || workspacePath
          : 'workspace'
        prompt += `\n## Workspace: ${wsLabel}\n`
        for (const m of workspaceMemories) {
          prompt += `- ${m.content}\n`
        }
      }

      return prompt
    }
  }))
)
