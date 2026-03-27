/**
 * 窗口控制 IPC Handler
 * 处理窗口最小化、最大化、关闭等操作
 */
import { ipcMain, app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'

export function registerWindowHandlers(): void {
  /** 获取应用版本号 */
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, () => app.getVersion())

  /** 查询当前窗口是否处于最大化状态 */
  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  /** 最小化窗口 */
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  /** 切换最大化 / 还原窗口 */
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  /** 关闭窗口 */
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
