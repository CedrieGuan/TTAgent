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
import type { AgentSkill } from '../shared/types/skill.types'
import type { ContextEvent } from '../shared/types/context.types'

const api = {
  // ── AI 对话 ──────────────────────────────────────────────────
  /** 发送消息并启动流式响应 */
  sendMessage: (payload: AIRequestPayload): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, payload),

  /** 取消指定会话的流式响应 */
  cancelStream: (sessionId: string): void =>
    ipcRenderer.send(IPC_CHANNELS.AI_CANCEL_STREAM, sessionId),

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

  // ── Agent 技能 ────────────────────────────────────────────────
  listSkills: (): Promise<IPCResponse<AgentSkill[]>> => ipcRenderer.invoke(IPC_CHANNELS.SKILL_LIST),

  createSkill: (
    skill: Omit<AgentSkill, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IPCResponse<AgentSkill>> => ipcRenderer.invoke(IPC_CHANNELS.SKILL_CREATE, skill),

  updateSkill: (
    id: string,
    updates: Partial<Pick<AgentSkill, 'name' | 'description' | 'instructions'>>
  ): Promise<IPCResponse<AgentSkill>> => ipcRenderer.invoke(IPC_CHANNELS.SKILL_UPDATE, id, updates),

  deleteSkill: (id: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_DELETE, id),

  toggleSkill: (id: string, enabled: boolean): Promise<IPCResponse<AgentSkill>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SKILL_TOGGLE, id, enabled),

  // ── 窗口控制 ──────────────────────────────────────────────────
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION)
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
