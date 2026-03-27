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

interface StoreSchema {
  providers: Partial<Record<string, ProviderConfig>>
  settings: AppSettings
  mcpServers: MCPServerConfig[]
  sessions: Session[]
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
