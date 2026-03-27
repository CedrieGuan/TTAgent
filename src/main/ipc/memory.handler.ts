/**
 * 记忆系统 IPC Handler
 * 提供记忆的读取、删除、清空和工作区路径管理功能
 */
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { store } from '../store'
import { memoryManager } from '../memory/memory-manager'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { Memory } from '@shared/types/memory.types'

export function registerMemoryHandlers(): void {
  /**
   * 获取全局和工作区记忆
   * 若未传 workspacePath，则工作区记忆返回空数组
   */
  ipcMain.handle(
    IPC_CHANNELS.MEMORY_GET,
    (_event, workspacePath?: string): IPCResponse<{ global: Memory[]; workspace: Memory[] }> => {
      try {
        const global = memoryManager.getGlobalMemories()
        const workspace = workspacePath ? memoryManager.getWorkspaceMemories(workspacePath) : []
        return { success: true, data: { global, workspace } }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * 删除单条记忆
   * scope: 'global' | 'workspace'
   */
  ipcMain.handle(
    IPC_CHANNELS.MEMORY_DELETE,
    (
      _event,
      payload: { scope: 'global' | 'workspace'; id: string; workspacePath?: string }
    ): IPCResponse => {
      try {
        if (payload.scope === 'global') {
          memoryManager.deleteGlobalMemory(payload.id)
        } else if (payload.workspacePath) {
          memoryManager.deleteWorkspaceMemory(payload.workspacePath, payload.id)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * 清空记忆（全局或工作区）
   */
  ipcMain.handle(
    IPC_CHANNELS.MEMORY_CLEAR,
    (
      _event,
      payload: { scope: 'global' | 'workspace'; workspacePath?: string }
    ): IPCResponse => {
      try {
        if (payload.scope === 'global') {
          memoryManager.clearGlobalMemories()
        } else if (payload.workspacePath) {
          memoryManager.clearWorkspaceMemories(payload.workspacePath)
        }
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  /** 获取当前配置的工作区路径 */
  ipcMain.handle(IPC_CHANNELS.MEMORY_GET_WORKSPACE_PATH, (): IPCResponse<string> => {
    try {
      const workspacePath = store.get('memoryWorkspacePath') ?? ''
      return { success: true, data: workspacePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** 设置工作区路径（空字符串表示清除） */
  ipcMain.handle(
    IPC_CHANNELS.MEMORY_SET_WORKSPACE_PATH,
    (_event, workspacePath: string): IPCResponse => {
      try {
        store.set('memoryWorkspacePath', workspacePath)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
