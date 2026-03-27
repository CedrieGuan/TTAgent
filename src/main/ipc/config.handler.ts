/**
 * 配置 IPC Handler
 * 处理应用配置的读取、写入和删除操作
 * 底层使用 electron-store 持久化存储
 */
import { ipcMain } from 'electron'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse } from '@shared/types/ipc.types'

export function registerConfigHandlers(): void {
  /** 读取单个配置项 */
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_event, key: string): IPCResponse => {
    try {
      const value = store.get(key as never)
      return { success: true, data: value }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** 写入单个配置项 */
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET,
    (_event, key: string, value: unknown): IPCResponse => {
      try {
        store.set(key as never, value as never)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  /** 读取全部配置（用于初始化渲染进程状态） */
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ALL, (): IPCResponse => {
    try {
      return { success: true, data: store.store }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  /** 删除单个配置项 */
  ipcMain.handle(IPC_CHANNELS.CONFIG_DELETE, (_event, key: string): IPCResponse => {
    try {
      store.delete(key as never)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
