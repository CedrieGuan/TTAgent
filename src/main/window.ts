/**
 * 主窗口管理模块
 * 负责创建和配置 Electron 主窗口
 */
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

/**
 * 创建主窗口
 * - macOS 使用 hiddenInset 标题栏样式（红绿灯按钮内嵌）
 * - 其他平台使用 hidden 标题栏（自定义标题栏）
 * - 启用 contextIsolation，禁用 nodeIntegration（安全最佳实践）
 */
export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    show: false,
    title: '',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 13 },
    backgroundColor: '#f5f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // 所有 target="_blank" 链接在系统默认浏览器打开，而非新 Electron 窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/** 获取当前主窗口实例（可能为 null） */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
