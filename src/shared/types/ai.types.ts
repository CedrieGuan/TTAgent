export type AIProvider = 'anthropic' | 'openai' | 'zhipuai' | 'ollama' | 'custom'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export type AttachmentType = 'image' | 'file'

export interface Attachment {
  type: AttachmentType
  name: string
  mimeType: string
  /** base64 编码的内容（图片）或纯文本（文本文件） */
  data: string
  size: number
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  attachments?: Attachment[]
  timestamp: number
  toolCalls?: MCPToolCall[]
  toolResults?: MCPToolResult[]
  isError?: boolean
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
}

export interface ProviderConfig {
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  defaultModel: string
}

export interface MCPToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: string
}

export interface MCPToolResult {
  tool_use_id: string
  content: string
  isError?: boolean
}
