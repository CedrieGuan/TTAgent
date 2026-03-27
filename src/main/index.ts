/**
 * Electron 主进程入口
 * 负责应用生命周期管理、单实例锁定和主窗口创建
 */
import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { registerAllHandlers } from './ipc'

// 单实例锁定：防止用户重复启动多个应用实例
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

  // macOS：点击 Dock 图标时若无窗口则重新创建
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// macOS 以外的平台：关闭所有窗口后退出应用
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
