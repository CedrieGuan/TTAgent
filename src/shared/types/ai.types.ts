/** AI 提供商标识 */
export type AIProvider = 'anthropic' | 'openai' | 'zhipuai' | 'ollama' | 'custom'

/** 消息角色类型 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/** 附件类型：图片或文件 */
export type AttachmentType = 'image' | 'file'

/** 消息附件（图片或文本文件） */
export interface Attachment {
  type: AttachmentType
  name: string
  mimeType: string
  /** base64 编码的内容（图片）或纯文本（文本文件） */
  data: string
  size: number
}

/** 聊天消息结构 */
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  attachments?: Attachment[]
  timestamp: number
  /** 本条消息触发的工具调用列表 */
  toolCalls?: MCPToolCall[]
  toolResults?: MCPToolResult[]
  isError?: boolean
}

/** 模型信息 */
export interface ModelInfo {
  id: string
  name: string
  /** 上下文窗口大小（token 数） */
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
}

/** AI 提供商配置 */
export interface ProviderConfig {
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  defaultModel: string
}

/** MCP 工具调用记录 */
export interface MCPToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: string
}

/** MCP 工具调用结果 */
export interface MCPToolResult {
  tool_use_id: string
  content: string
  isError?: boolean
}
