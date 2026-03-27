import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { registerAllHandlers } from './ipc'

// 单实例锁定，防止重复启动
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ttagent.app')

  // 开发环境快捷键（F12 打开 DevTools，F5 刷新）
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 注册所有 IPC handlers
  registerAllHandlers()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// macOS 以外的平台：关闭所有窗口后退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 第二个实例尝试启动时，聚焦已有窗口
app.on('second-instance', () => {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore()
    windows[0].focus()
  }
})
