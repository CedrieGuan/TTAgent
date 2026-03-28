/**
 * 任务类型定义
 * 任务大厅功能的核心数据结构，包含任务、子任务和事件类型
 */

/** 任务优先级 */
export type TaskPriority = 'urgent' | 'normal' | 'low'

/** 任务周期 */
export type TaskPeriod = 'short' | 'long'

/** 任务状态 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'

/** 子任务 */
export interface SubTask {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

/** 任务 */
export interface Task {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  period: TaskPeriod
  /** 顶层状态由用户手动设置，也可根据子任务自动推导 */
  status: TaskStatus
  tags: string[]
  /** 子任务列表 */
  subtasks: SubTask[]
  /** 0-100，自动从 subtasks 完成比例计算（无子任务则手动） */
  progress: number
  /** 截止日期时间戳 */
  dueDate?: number
  createdAt: number
  updatedAt: number
}

/** 任务变更事件（主进程 → 渲染进程） */
export interface TaskEvent {
  type: 'created' | 'updated' | 'deleted'
  task?: Task
  taskId?: string
}
