/** AI 提供商标识 */
export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'zhipuai'
  | 'openrouter'
  | 'huggingface'
  | 'modelscope'
  | 'nvidia'
  | 'ollama'
  | 'custom'

/** 提供商分类 */
export type ProviderCategory = 'cloud' | 'aggregator' | 'chinese' | 'other'

/** 提供商定义（注册表条目） */
export interface ProviderDefinition {
  /** 提供商标识 */
  id: AIProvider
  /** 显示名称 */
  name: string
  /** 简短描述 */
  description: string
  /** 分类 */
  category: ProviderCategory
  /** API 协议类型 */
  apiType: 'anthropic' | 'openai-compatible'
  /** 默认 API 基础地址（OpenAI 兼容接口使用） */
  defaultBaseUrl?: string
  /** 是否需要 API Key */
  requiresApiKey: boolean
  /** 是否显示 Base URL 配置项 */
  showBaseUrl: boolean
  /** 预定义的模型列表 */
  models: ModelInfo[]
  /** 获取 API Key 的官网地址 */
  website: string
  /** 品牌色 */
  color: string
}

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
  /** 本条消息激活的技能（通过斜杠命令触发） */
  activatedSkill?: { name: string; description: string }
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
