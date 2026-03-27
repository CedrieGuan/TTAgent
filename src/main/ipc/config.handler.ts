import { ipcMain } from 'electron'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse } from '@shared/types/ipc.types'

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_event, key: string): IPCResponse => {
    try {
      const value = store.get(key as never)
      return { success: true, data: value }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

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

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ALL, (): IPCResponse => {
    try {
      return { success: true, data: store.store }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_DELETE, (_event, key: string): IPCResponse => {
    try {
      store.delete(key as never)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
