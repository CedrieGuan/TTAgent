/**
 * 持久化存储模块
 * 使用 electron-store 将应用数据存储到用户数据目录
 * 包含提供商配置、应用设置、会话、消息、MCP 服务器和技能
 */
import Store from 'electron-store'
import type { ProviderConfig } from '@shared/types/ai.types'
import type { MCPServerConfig } from '@shared/types/mcp.types'
import type { AgentSkill } from '@shared/types/skill.types'
import type { Session, SessionWithMessages } from '@shared/types/session.types'
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@shared/constants/providers'
import { BUILT_IN_SKILLS } from '@shared/constants/builtin-skills'

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
  agentSkills: AgentSkill[]
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
    agentSystemPrompt: 'You are a helpful AI assistant.',
    /** 内置技能默认禁用，用户可按需启用 */
    agentSkills: BUILT_IN_SKILLS
  }
})

export { store }
export type { AppSettings, StoreSchema }
