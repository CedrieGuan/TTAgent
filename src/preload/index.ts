/**
 * Preload 脚本
 * 通过 contextBridge 将安全的 API 暴露给渲染进程
 * 渲染进程通过 window.api 访问所有 IPC 功能
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/ipc.channels'
import type {
  AIRequestPayload,
  AIStreamChunk,
  IPCResponse,
  CreateSessionPayload,
  UpdateSessionPayload,
  MCPCallToolPayload,
  MCPConnectPayload
} from '../shared/types/ipc.types'
import type { Session } from '../shared/types/session.types'
import type { ChatMessage } from '../shared/types/ai.types'
import type { MCPServerStatus, MCPTool } from '../shared/types/mcp.types'
import type { Skill, SkillSummary } from '../shared/types/skill.types'
import type { ContextEvent } from '../shared/types/context.types'
import type { Memory, MemoryEvent } from '../shared/types/memory.types'
import type { Task, TaskEvent } from '../shared/types/task.types'

const api = {
  // ── AI 对话 ──────────────────────────────────────────────────
  /** 发送消息并启动流式响应 */
  sendMessage: (payload: AIRequestPayload): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, payload),

  /** 取消指定会话的流式响应 */
  cancelStream: (sessionId: string): void =>
    ipcRenderer.send(IPC_CHANNELS.AI_CANCEL_STREAM, sessionId),

  /** 响应工具确认请求（Allow / Reject / Always Allow） */
  sendToolConfirmResponse: (payload: {
    confirmId: string
    response: 'allow' | 'reject' | 'always_allow'
  }): void => ipcRenderer.send(IPC_CHANNELS.AI_TOOL_CONFIRM_RESPONSE, payload),

  /** 注册流式响应事件监听，返回清理函数（用于 useEffect cleanup） */
  onStreamChunk: (callback: (chunk: AIStreamChunk) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, chunk: AIStreamChunk) => callback(chunk)
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
  },

  /** 注册上下文管理事件监听，返回清理函数 */
  onContextEvent: (callback: (event: ContextEvent) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: ContextEvent) => callback(event)
    ipcRenderer.on(IPC_CHANNELS.CONTEXT_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONTEXT_EVENT, listener)
  },

  /** 手动触发上下文压缩 */
  compressContext: (payload: {
    sessionId: string
    provider: string
    model: string
    systemPrompt?: string
    mcpToolsCount?: number
  }): Promise<IPCResponse> => ipcRenderer.invoke(IPC_CHANNELS.CONTEXT_COMPRESS, payload),

  // ── 会话管理 ──────────────────────────────────────────────────
  listSessions: (): Promise<IPCResponse<Session[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),

  createSession: (payload?: CreateSessionPayload): Promise<IPCResponse<Session>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, payload),

  deleteSession: (id: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),

  updateSession: (payload: UpdateSessionPayload): Promise<IPCResponse<Session>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_UPDATE, payload),

  getSessionMessages: (id: string): Promise<IPCResponse<ChatMessage[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET_MESSAGES, id),

  clearSessionMessages: (id: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SESSION_CLEAR_MESSAGES, id),

  // ── 配置管理 ──────────────────────────────────────────────────
  getConfig: (key: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),

  setConfig: (key: string, value: unknown): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value),

  getAllConfig: (): Promise<IPCResponse> => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),

  deleteConfig: (key: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_DELETE, key),

  // ── MCP 工具 ──────────────────────────────────────────────────
  listMCPServers: (): Promise<IPCResponse<MCPServerStatus[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_LIST_SERVERS),

  listMCPTools: (): Promise<IPCResponse<MCPTool[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_LIST_TOOLS),

  callMCPTool: (payload: MCPCallToolPayload): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_CALL_TOOL, payload),

  connectMCPServer: (payload: MCPConnectPayload): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_CONNECT_SERVER, payload),

  disconnectMCPServer: (name: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MCP_DISCONNECT_SERVER, name),

  // ── 文件技能（基于 SKILL.md） ──────────────────────────────────
  /** 扫描技能目录，返回所有技能摘要 */
  discoverSkills: (): Promise<IPCResponse<SkillSummary[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_DISCOVER),

  /** 按 ID 加载技能完整指令 */
  loadSkill: (id: string): Promise<IPCResponse<Skill>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_LOAD, id),

  /** 用系统文件管理器打开技能目录 */
  openSkillDir: (): Promise<IPCResponse> => ipcRenderer.invoke(IPC_CHANNELS.SKILL_OPEN_DIR),

  // ── 长期记忆 ──────────────────────────────────────────────────
  /** 获取全局和工作区记忆 */
  getMemories: (
    workspacePath?: string
  ): Promise<IPCResponse<{ global: Memory[]; workspace: Memory[] }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET, workspacePath),

  /** 删除单条记忆 */
  deleteMemory: (payload: {
    scope: 'global' | 'workspace'
    id: string
    workspacePath?: string
  }): Promise<IPCResponse> => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_DELETE, payload),

  /** 清空记忆（全局或工作区） */
  clearMemories: (payload: {
    scope: 'global' | 'workspace'
    workspacePath?: string
  }): Promise<IPCResponse> => ipcRenderer.invoke(IPC_CHANNELS.MEMORY_CLEAR, payload),

  /** 获取当前工作区路径 */
  getMemoryWorkspacePath: (): Promise<IPCResponse<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORY_GET_WORKSPACE_PATH),

  /** 设置工作区路径（空字符串表示清除） */
  setMemoryWorkspacePath: (workspacePath: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORY_SET_WORKSPACE_PATH, workspacePath),

  /** 注册记忆事件监听，返回清理函数 */
  onMemoryEvent: (callback: (event: MemoryEvent) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: MemoryEvent) => callback(event)
    ipcRenderer.on(IPC_CHANNELS.MEMORY_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MEMORY_EVENT, listener)
  },

  // ── 任务大厅 ──────────────────────────────────────────────────
  listTasks: (): Promise<IPCResponse<Task[]>> => ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST),

  createTask: (opts: {
    title: string
    description?: string
    priority?: 'urgent' | 'normal' | 'low'
    period?: 'short' | 'long'
    tags?: string[]
    dueDate?: number
    subtasks?: { title: string }[]
  }): Promise<IPCResponse<Task>> => ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, opts),

  updateTask: (taskId: string, updates: Record<string, unknown>): Promise<IPCResponse<Task>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, taskId, updates),

  deleteTask: (taskId: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, taskId),

  onTaskEvent: (callback: (event: TaskEvent) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: TaskEvent) => callback(event)
    ipcRenderer.on(IPC_CHANNELS.TASK_EVENT, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.TASK_EVENT, listener)
  },

  // ── 开发日志 ──────────────────────────────────────────────────
  /** 注册主进程日志推送监听（仅开发环境有效），返回清理函数 */
  onLogEntry: (
    callback: (entry: {
      timestamp: number
      level: string
      scope: string
      message: string
      data?: string
    }) => void
  ): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, entry: unknown) =>
      callback(
        entry as { timestamp: number; level: string; scope: string; message: string; data?: string }
      )
    ipcRenderer.on(IPC_CHANNELS.LOG_ENTRY, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOG_ENTRY, listener)
  },

  // ── 窗口控制 ──────────────────────────────────────────────────
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION)
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
