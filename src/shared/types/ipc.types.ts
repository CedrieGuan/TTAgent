import type { AIProvider, ChatMessage } from './ai.types'
import type { MCPTool } from './mcp.types'

// 统一的 IPC 响应包装
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// AI 请求载荷
export interface AIRequestPayload {
  sessionId: string
  messages: ChatMessage[]
  provider: AIProvider
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  mcpTools?: MCPTool[]
}

// AI 流式块
export type AIStreamChunkType =
  | 'text_delta'
  | 'tool_use_start'
  | 'tool_use_delta'
  | 'tool_result'
  | 'stop'
  | 'error'
  | 'agent_message'

export interface AIStreamChunk {
  type: AIStreamChunkType
  sessionId: string
  content?: string
  toolCallId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  /** tool_result 专用：工具执行输出 */
  toolOutput?: string
  /** tool_result 专用：工具执行是否出错 */
  toolIsError?: boolean
  /** agent_message 专用：中间轮次的完整 assistant 消息（含 toolCalls） */
  agentMessage?: ChatMessage
  error?: string
}

// 会话操作载荷
export interface CreateSessionPayload {
  title?: string
  systemPrompt?: string
}

export interface UpdateSessionPayload {
  id: string
  title?: string
  systemPrompt?: string
  model?: string
  provider?: AIProvider
}

// MCP 工具调用载荷
export interface MCPCallToolPayload {
  serverName: string
  name: string
  args: Record<string, unknown>
}

// MCP 服务器连接载荷
export interface MCPConnectPayload {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}
