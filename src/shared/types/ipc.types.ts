import type { AIProvider, ChatMessage } from './ai.types'
import type { MCPTool } from './mcp.types'

/** 统一的 IPC 响应包装，所有 handler 均返回此结构 */
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 发送 AI 请求的载荷 */
export interface AIRequestPayload {
  sessionId: string
  messages: ChatMessage[]
  provider: AIProvider
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /** 可用的 MCP 工具列表（为空则不启用工具调用） */
  mcpTools?: MCPTool[]
}

/** AI 流式响应块的类型枚举 */
export type AIStreamChunkType =
  | 'text_delta'          // 文本增量
  | 'tool_use_start'      // 工具调用开始
  | 'tool_use_delta'      // 工具调用参数增量
  | 'tool_result'         // 工具执行结果
  | 'stop'                // 流结束
  | 'error'               // 错误
  | 'agent_message'       // Agent 中间轮次完整消息
  | 'tool_confirm_request' // 危险工具执行前的用户确认请求

/** AI 流式响应块 */
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
  /** tool_confirm_request 专用：唯一确认请求 ID（用于匹配响应） */
  confirmId?: string
}

/** 创建会话的请求载荷 */
export interface CreateSessionPayload {
  title?: string
  systemPrompt?: string
}

/** 更新会话的请求载荷 */
export interface UpdateSessionPayload {
  id: string
  title?: string
  systemPrompt?: string
  model?: string
  provider?: AIProvider
}

/** 直接调用 MCP 工具的载荷 */
export interface MCPCallToolPayload {
  serverName: string
  name: string
  args: Record<string, unknown>
}

/** 连接 MCP 服务器的载荷 */
export interface MCPConnectPayload {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}
