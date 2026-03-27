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

const api = {
  // ── AI ──────────────────────────────────────────────────────
  sendMessage: (payload: AIRequestPayload): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, payload),

  cancelStream: (sessionId: string): void =>
    ipcRenderer.send(IPC_CHANNELS.AI_CANCEL_STREAM, sessionId),

  /** 注册流式事件监听，返回清理函数 */
  onStreamChunk: (callback: (chunk: AIStreamChunk) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, chunk: AIStreamChunk) => callback(chunk)
    ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_STREAM_CHUNK, listener)
  },

  // ── Sessions ─────────────────────────────────────────────────
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

  // ── Config ───────────────────────────────────────────────────
  getConfig: (key: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),

  setConfig: (key: string, value: unknown): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value),

  getAllConfig: (): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET_ALL),

  deleteConfig: (key: string): Promise<IPCResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_DELETE, key),

  // ── MCP ──────────────────────────────────────────────────────
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

  // ── Window ───────────────────────────────────────────────────
  minimizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: (): void => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION)
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
