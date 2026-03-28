/**
 * 统一日志模块
 * 基于 electron-log 实现：结构化日志、文件持久化、开发时实时推送到渲染进程
 *
 * 功能：
 * - 多作用域 logger（ai、mcp、memory、ipc 等）
 * - 文件持久化到 userData/logs/main.log，自动轮转
 * - 开发时日志实时推送到渲染进程（DevTools 和日志面板可见）
 * - 全局未捕获异常和未处理 Promise 拒绝
 */
import log from 'electron-log/main'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
type LogMessage = {
  data: any[]
  date: Date
  level: string
  logId?: string
  scope?: string
  variables?: Record<string, any>
}

/** 单条日志条目的数据结构，用于推送到渲染进程 */
export interface LogEntry {
  timestamp: number
  level: string
  scope: string
  message: string
  data?: string
}

/** 日志最大缓存条数，防止内存溢出 */
const MAX_LOG_BUFFER = 2000

/** 日志缓存，渲染进程首次打开日志面板时一次性推送 */
let logBuffer: LogEntry[] = []

/**
 * 将日志消息转换为 LogEntry 并缓存/推送
 * 仅在开发环境被调用
 */
function handleLogMessage(message: LogMessage): void {
  const entry: LogEntry = {
    timestamp: message.date.getTime(),
    level: message.level,
    scope: message.scope ?? 'main',
    message:
      typeof message.data[0] === 'string' ? message.data[0] : JSON.stringify(message.data[0]),
    data:
      message.data.length > 1
        ? message.data
            .slice(1)
            .map((d: unknown) => (typeof d === 'string' ? d : JSON.stringify(d, null, 2)))
            .join(' ')
        : undefined
  }

  // 缓存日志（环形缓冲）
  logBuffer.push(entry)
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer = logBuffer.slice(-Math.floor(MAX_LOG_BUFFER / 2))
  }

  // 推送到所有活跃的渲染进程窗口
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.LOG_ENTRY, entry)
    }
  }
}

/**
 * 初始化日志系统
 * 必须在 app.whenReady() 之前调用，以确保 electron-log 正确拦截 console 方法
 */
export function initLogger(): void {
  // 初始化 electron-log（拦截 console 方法，启用 IPC 通信）
  log.initialize({ preload: true })

  // 开发环境判断
  const isDev = !app.isPackaged

  // 文件传输配置
  log.transports.file.level = isDev ? 'debug' : 'info'
  log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log')

  // 控制台传输配置
  log.transports.console.level = isDev ? 'silly' : 'warn'
  log.transports.console.format = '{h}:{i}:{s}.{ms} [{level}] {text}'

  // 全局错误捕获：未处理异常和 Promise 拒绝
  log.errorHandler.startCatching({
    showDialog: false
  })

  // 记录 Electron 关键事件（崩溃、加载失败等）
  log.eventLogger.startLogging()

  // 开发环境：注册自定义 transport，将日志推送到渲染进程
  if (isDev) {
    const streamTransport = (message: LogMessage): void => handleLogMessage(message)
    ;(streamTransport as any).level = 'debug'
    ;(streamTransport as any).transforms = []
    log.transports['rendererStream'] = streamTransport as any
  }

  log.info('Logger', '日志系统已初始化')
}

/**
 * 获取缓存的日志条目
 * 渲染进程打开日志面板时调用，一次性拉取历史日志
 */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer]
}

/**
 * 清空日志缓存
 * 渲染进程调用以释放内存
 */
export function clearLogBuffer(): void {
  logBuffer = []
}

/** 创建带作用域的日志记录器，便于按模块过滤 */
export const logger = {
  main: log.scope('main'),
  ai: log.scope('ai'),
  mcp: log.scope('mcp'),
  memory: log.scope('memory'),
  ipc: log.scope('ipc'),
  tool: log.scope('tool'),
  skill: log.scope('skill'),
  context: log.scope('context')
}

export default log
