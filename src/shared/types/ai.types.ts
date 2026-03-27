export type AIProvider = 'anthropic' | 'openai' | 'zhipuai' | 'ollama' | 'custom'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
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
