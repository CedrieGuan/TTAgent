/**
 * 任务 Store
 * 管理任务列表、筛选状态和 CRUD 操作
 * 使用 immer 中间件支持不可变状态更新
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Task, TaskEvent, TaskStatus, TaskPeriod, SubTask } from '@shared/types/task.types'

type StatusFilter = 'all' | TaskStatus
type PeriodFilter = 'all' | TaskPeriod

interface TaskState {
  tasks: Task[]
  statusFilter: StatusFilter
  periodFilter: PeriodFilter
  expandedTasks: Set<string>
  loaded: boolean

  filteredTasks: () => Task[]
  completionStats: () => { total: number; completed: number; percent: number }

  loadTasks: () => Promise<void>
  createTask: (opts: {
    title: string
    description?: string
    priority?: 'urgent' | 'normal' | 'low'
    period?: 'short' | 'long'
    tags?: string[]
    dueDate?: number
    subtasks?: { title: string }[]
  }) => Promise<void>
  updateTask: (taskId: string, updates: Record<string, unknown>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  toggleTaskStatus: (taskId: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  setStatusFilter: (filter: StatusFilter) => void
  setPeriodFilter: (filter: PeriodFilter) => void
  toggleExpanded: (taskId: string) => void
  handleTaskEvent: (event: TaskEvent) => void
}

export const useTaskStore = create<TaskState>()(
  immer((set, get) => ({
    tasks: [],
    statusFilter: 'all',
    periodFilter: 'all',
    expandedTasks: new Set<string>(),
    loaded: false,

    filteredTasks: () => {
      const { tasks, statusFilter, periodFilter } = get()
      return tasks.filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (periodFilter !== 'all' && t.period !== periodFilter) return false
        return true
      })
    },

    completionStats: () => {
      const { tasks } = get()
      const total = tasks.length
      const completed = tasks.filter((t) => t.status === 'completed').length
      return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
    },

    loadTasks: async () => {
      const res = await window.api.listTasks()
      if (res.success && res.data) {
        set((state) => {
          state.tasks = res.data!
          state.loaded = true
        })
      }
    },

    createTask: async (opts) => {
      const res = await window.api.createTask(opts)
      if (res.success && res.data) {
        set((state) => {
          state.tasks.push(res.data!)
        })
      }
    },

    updateTask: async (taskId, updates) => {
      const res = await window.api.updateTask(taskId, updates)
      if (res.success && res.data) {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === taskId)
          if (idx !== -1) state.tasks[idx] = res.data!
        })
      }
    },

    deleteTask: async (taskId) => {
      const res = await window.api.deleteTask(taskId)
      if (res.success) {
        set((state) => {
          state.tasks = state.tasks.filter((t) => t.id !== taskId)
        })
      }
    },

    toggleTaskStatus: async (taskId) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed'
      const res = await window.api.updateTask(taskId, { status: newStatus })
      if (res.success && res.data) {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === taskId)
          if (idx !== -1) state.tasks[idx] = res.data!
        })
      }
    },

    toggleSubtask: async (taskId, subtaskId) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      const subtasks: SubTask[] = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      )
      const res = await window.api.updateTask(taskId, { subtasks })
      if (res.success && res.data) {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === taskId)
          if (idx !== -1) state.tasks[idx] = res.data!
        })
      }
    },

    addSubtask: async (taskId, title) => {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      const newSubtask: SubTask = {
        id: crypto.randomUUID(),
        title,
        completed: false,
        createdAt: Date.now()
      }
      const subtasks = [...task.subtasks, newSubtask]
      const res = await window.api.updateTask(taskId, { subtasks })
      if (res.success && res.data) {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === taskId)
          if (idx !== -1) state.tasks[idx] = res.data!
        })
      }
    },

    setStatusFilter: (filter) =>
      set((state) => {
        state.statusFilter = filter
      }),

    setPeriodFilter: (filter) =>
      set((state) => {
        state.periodFilter = filter
      }),

    toggleExpanded: (taskId) =>
      set((state) => {
        if (state.expandedTasks.has(taskId)) {
          state.expandedTasks.delete(taskId)
        } else {
          state.expandedTasks.add(taskId)
        }
      }),

    handleTaskEvent: (event) => {
      if (event.type === 'created' && event.task) {
        set((state) => {
          if (!state.tasks.some((t) => t.id === event.task!.id)) {
            state.tasks.push(event.task!)
          }
        })
      } else if (event.type === 'updated' && event.task) {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === event.task!.id)
          if (idx !== -1) state.tasks[idx] = event.task!
        })
      } else if (event.type === 'deleted' && event.taskId) {
        set((state) => {
          state.tasks = state.tasks.filter((t) => t.id !== event.taskId)
        })
      }
    }
  }))
)
