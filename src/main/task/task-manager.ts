/**
 * 任务管理器
 * 封装任务的 CRUD 操作，数据持久化到 electron-store 的 tasks 字段
 * 参考 MemoryManager 的单例模式设计
 */
import { randomUUID } from 'crypto'
import { store } from '../store'
import { logger } from '../logger'
import type { Task, SubTask, TaskPriority, TaskPeriod, TaskStatus } from '@shared/types/task.types'

export class TaskManager {
  /** 获取所有任务列表 */
  listTasks(): Task[] {
    return store.get('tasks') ?? []
  }

  /**
   * 创建新任务
   * 自动生成 id 和时间戳，根据子任务计算初始进度
   */
  createTask(opts: {
    title: string
    description?: string
    priority?: TaskPriority
    period?: TaskPeriod
    tags?: string[]
    dueDate?: number
    subtasks?: { title: string }[]
  }): Task {
    const now = Date.now()
    const subtasks: SubTask[] = (opts.subtasks ?? []).map((s) => ({
      id: randomUUID(),
      title: s.title,
      completed: false,
      createdAt: now
    }))

    const task: Task = {
      id: randomUUID(),
      title: opts.title,
      description: opts.description,
      priority: opts.priority ?? 'normal',
      period: opts.period ?? 'short',
      status: 'pending',
      tags: opts.tags ?? [],
      subtasks,
      progress: this.calcProgress(subtasks),
      dueDate: opts.dueDate,
      createdAt: now,
      updatedAt: now
    }

    const tasks = this.listTasks()
    tasks.push(task)
    store.set('tasks', tasks)
    logger.task.info(`创建任务: ${task.title} (${task.id})`)
    return task
  }

  /**
   * 更新任务
   * 支持部分更新，自动重算 updatedAt 和进度
   */
  updateTask(
    taskId: string,
    updates: Partial<{
      title: string
      description: string
      priority: TaskPriority
      period: TaskPeriod
      status: TaskStatus
      tags: string[]
      subtasks: SubTask[]
      dueDate: number | undefined
      progress: number
    }>
  ): Task | null {
    const tasks = this.listTasks()
    const idx = tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) return null

    const task = tasks[idx]
    Object.assign(task, updates, { updatedAt: Date.now() })

    // 有子任务更新时自动重算进度
    if (updates.subtasks !== undefined) {
      task.progress = this.calcProgress(task.subtasks)
    }

    tasks[idx] = task
    store.set('tasks', tasks)
    logger.task.info(`更新任务: ${task.title} (${task.id})`)
    return task
  }

  /** 删除任务 */
  deleteTask(taskId: string): boolean {
    const tasks = this.listTasks()
    const filtered = tasks.filter((t) => t.id !== taskId)
    if (filtered.length === tasks.length) return false
    store.set('tasks', filtered)
    logger.task.info(`删除任务: ${taskId}`)
    return true
  }

  /** 根据子任务完成比例计算进度（无子任务返回 0） */
  private calcProgress(subtasks: SubTask[]): number {
    if (subtasks.length === 0) return 0
    const completed = subtasks.filter((s) => s.completed).length
    return Math.round((completed / subtasks.length) * 100)
  }
}

/** 全局单例，所有模块共享同一个 TaskManager 实例 */
export const taskManager = new TaskManager()
