/**
 * 长期记忆系统类型定义
 * 包含记忆条目、事件和提取结果的数据结构
 */

/** 单条记忆条目 */
export interface Memory {
  /** 唯一标识符 */
  id: string
  /** 记忆内容（1-2 句话的简洁描述） */
  content: string
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 最后更新时间戳（毫秒） */
  updatedAt: number
  /** 来源会话 ID */
  sessionId?: string
}

/** 记忆范围 */
export type MemoryScope = 'global' | 'workspace'

/** 记忆事件类型 */
export type MemoryEventType =
  | 'memory_extraction_started'   // LLM 开始从对话中提取记忆
  | 'memory_extraction_completed' // 提取完成（可能有新记忆）
  | 'memory_extraction_failed'    // 提取失败

/** 记忆事件（由主进程推送给渲染进程，用于 UI 展示） */
export interface MemoryEvent {
  type: MemoryEventType
  /** 关联的会话 ID */
  sessionId: string
  /** 事件时间戳 */
  timestamp: number
  /** 人类可读的事件描述 */
  message: string
  /** 本次新增的记忆数量（extraction_completed 时有效） */
  addedCount?: number
}

/** 记忆文件的持久化格式 */
export interface MemoryFile {
  memories: Memory[]
  lastUpdated: number
}

/** LLM 记忆提取的结构化输出 */
export interface MemoryExtractionResult {
  /** 全局记忆（关于用户本人） */
  global: string[]
  /** 工作区记忆（关于当前项目） */
  workspace: string[]
}
