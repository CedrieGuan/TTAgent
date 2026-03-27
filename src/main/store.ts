/**
 * 持久化存储模块
 * 使用 electron-store 将应用数据存储到用户数据目录
 * 包含提供商配置、应用设置、会话、消息和 MCP 服务器
 */
import Store from 'electron-store'
import type { ProviderConfig } from '@shared/types/ai.types'
import type { MCPServerConfig } from '@shared/types/mcp.types'
import type { Session, SessionWithMessages } from '@shared/types/session.types'
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@shared/constants/providers'

interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  fontSize: number
  sendOnEnter: boolean
}

/** 持久化存储的完整 Schema */
interface StoreSchema {
  providers: Partial<Record<string, ProviderConfig>>
  settings: AppSettings
  mcpServers: MCPServerConfig[]
  sessions: Session[]
  /** 消息按 sessionId 分组存储 */
  messages: Record<string, SessionWithMessages['messages']>
  agentSystemPrompt: string
}

const store = new Store<StoreSchema>({
  defaults: {
    providers: {
      anthropic: {
        provider: DEFAULT_PROVIDER,
        apiKey: '',
        defaultModel: DEFAULT_MODEL
      },
      zhipuai: {
        provider: 'zhipuai',
        apiKey: '',
        defaultModel: DEFAULT_MODEL
      }
    },
    settings: {
      theme: 'dark',
      language: 'zh',
      fontSize: 14,
      sendOnEnter: true
    },
    mcpServers: [],
    sessions: [],
    messages: {},
    agentSystemPrompt: 'You are a helpful AI assistant.'
  }
})

export { store }
export type { AppSettings, StoreSchema }

