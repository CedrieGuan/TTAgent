/**
 * 日志 Store
 * 管理开发者日志条目的缓冲、过滤与清除
 * 模块级 logBuffer 限制最多 100 条，超出时裁剪最早的记录
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 单条日志条目 */
export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  scope: string
  message: string
}

interface LogState {
  /** 当前活跃过滤的日志级别（空数组 = 不过滤） */
  filterLevels: LogLevel[]
  /** 当前活跃过滤的作用域（空数组 = 不过滤） */
  filterScopes: string[]
  /** 面板是否展开 */
  isOpen: boolean
  /** 是否自动滚动到底部 */
  autoScroll: boolean

  setFilterLevels: (levels: LogLevel[]) => void
  toggleFilterLevel: (level: LogLevel) => void
  setFilterScopes: (scopes: string[]) => void
  toggleFilterScope: (scope: string) => void
  setOpen: (open: boolean) => void
  toggleOpen: () => void
  setAutoScroll: (on: boolean) => void
  toggleAutoScroll: () => void
}

/* 模块级日志缓冲，独立于 React 渲染周期，最多保留 100 条 */
let logBuffer: LogEntry[] = []
let totalEntries = 0

/** 生成带时间戳的日志 ID */
function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 获取 ISO 格式的短时间戳 HH:MM:SS.mmm */
function shortTimestamp(): string {
  return new Date().toISOString().slice(11, -1)
}

/** 向缓冲写入一条日志（超出 100 条时裁剪） */
export function pushLog(level: LogLevel, scope: string, message: string): void {
  const entry: LogEntry = {
    id: nextId(),
    timestamp: shortTimestamp(),
    level,
    scope,
    message
  }
  logBuffer.push(entry)
  totalEntries++
  if (logBuffer.length > 100) {
    logBuffer = logBuffer.slice(-100)
  }
}

export const useLogStore = create<LogState>()(
  immer((set) => ({
    filterLevels: [],
    filterScopes: [],
    isOpen: false,
    autoScroll: true,

    setFilterLevels: (levels) =>
      set((state) => {
        state.filterLevels = levels
      }),

    toggleFilterLevel: (level) =>
      set((state) => {
        const idx = state.filterLevels.indexOf(level)
        if (idx === -1) {
          state.filterLevels.push(level)
        } else {
          state.filterLevels.splice(idx, 1)
        }
      }),

    setFilterScopes: (scopes) =>
      set((state) => {
        state.filterScopes = scopes
      }),

    toggleFilterScope: (scope) =>
      set((state) => {
        const idx = state.filterScopes.indexOf(scope)
        if (idx === -1) {
          state.filterScopes.push(scope)
        } else {
          state.filterScopes.splice(idx, 1)
        }
      }),

    setOpen: (open) =>
      set((state) => {
        state.isOpen = open
      }),

    toggleOpen: () =>
      set((state) => {
        state.isOpen = !state.isOpen
      }),

    setAutoScroll: (on) =>
      set((state) => {
        state.autoScroll = on
      }),

    toggleAutoScroll: () =>
      set((state) => {
        state.autoScroll = !state.autoScroll
      })
  }))
)

/**
 * 获取所有日志条目的快照（当前缓冲内容）
 */
export function getLogEntries(): LogEntry[] {
  return [...logBuffer]
}

/**
 * 获取经过过滤后的日志条目
 */
export function getFilteredEntries(filterLevels: LogLevel[], filterScopes: string[]): LogEntry[] {
  let entries = [...logBuffer]
  if (filterLevels.length > 0) {
    entries = entries.filter((e) => filterLevels.includes(e.level))
  }
  if (filterScopes.length > 0) {
    entries = entries.filter((e) => filterScopes.includes(e.scope))
  }
  return entries
}

/**
 * 获取缓冲条目数量
 */
export function getLogCount(): number {
  return logBuffer.length
}

/**
 * 获取累计总条目数（包含已被裁剪的）
 */
export function getTotalCount(): number {
  return totalEntries
}

/**
 * 获取所有已知的作用域（去重）
 */
export function getAvailableScopes(): string[] {
  return [...new Set(logBuffer.map((e) => e.scope))]
}

/**
 * 清空所有日志
 */
export function clearAllLogs(): void {
  logBuffer = []
  totalEntries = 0
}
