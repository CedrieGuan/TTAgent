/**
 * 任务大厅 IPC Handler
 * 提供任务的 CRUD 操作和事件广播功能
 */
import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { taskManager } from '../task/task-manager'
import { logger } from '../logger'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { Task, TaskEvent } from '@shared/types/task.types'

/** 向所有渲染进程窗口广播任务变更事件 */
export function broadcastTaskEvent(event: TaskEvent): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.TASK_EVENT, event)
    }
  }
}

export function registerTaskHandlers(): void {
  /** 获取所有任务列表 */
  ipcMain.handle(IPC_CHANNELS.TASK_LIST, (): IPCResponse<Task[]> => {
    try {
      const tasks = taskManager.listTasks()
      return { success: true, data: tasks }
    } catch (err) {
      logger.task.error('获取任务列表失败:', err)
      return { success: false, error: String(err) }
    }
  })

  /** 创建新任务 */
  ipcMain.handle(
    IPC_CHANNELS.TASK_CREATE,
    (_event, opts: Parameters<typeof taskManager.createTask>[0]): IPCResponse<Task> => {
      try {
        const task = taskManager.createTask(opts)
        broadcastTaskEvent({ type: 'created', task })
        return { success: true, data: task }
      } catch (err) {
        logger.task.error('创建任务失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /** 更新任务 */
  ipcMain.handle(
    IPC_CHANNELS.TASK_UPDATE,
    (
      _event,
      taskId: string,
      updates: Parameters<typeof taskManager.updateTask>[1]
    ): IPCResponse<Task> => {
      try {
        const task = taskManager.updateTask(taskId, updates)
        if (!task) return { success: false, error: '任务不存在' }
        broadcastTaskEvent({ type: 'updated', task })
        return { success: true, data: task }
      } catch (err) {
        logger.task.error('更新任务失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /** 删除任务 */
  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, (_event, taskId: string): IPCResponse => {
    try {
      const ok = taskManager.deleteTask(taskId)
      if (!ok) return { success: false, error: '任务不存在' }
      broadcastTaskEvent({ type: 'deleted', taskId })
      return { success: true }
    } catch (err) {
      logger.task.error('删除任务失败:', err)
      return { success: false, error: String(err) }
    }
  })
}
