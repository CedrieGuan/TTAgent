/**
 * 设置 Store
 * 管理应用外观设置、AI 提供商配置和 Agent 系统提示
 */
import { create } from 'zustand'
import type { ProviderConfig } from '@shared/types/ai.types'
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@shared/constants/providers'

interface AppSettings {
  theme: 'dark' | 'light' | 'system'
  language: string
  fontSize: number
  sendOnEnter: boolean
}

interface SettingsState {
  settings: AppSettings
  /** 各提供商的 API 配置（providerId -> config） */
  providers: Partial<Record<string, ProviderConfig>>
  agentSystemPrompt: string
  /** 是否已从主进程加载完配置 */
  loaded: boolean

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  updateProvider: (providerId: string, config: ProviderConfig) => Promise<void>
  updateAgentSystemPrompt: (prompt: string) => Promise<void>
  getActiveProviderConfig: () => ProviderConfig | undefined
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'zh',
  fontSize: 14,
  sendOnEnter: true
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  providers: {
    anthropic: { provider: 'anthropic', apiKey: '', defaultModel: 'claude-sonnet-4-6' },
    zhipuai: { provider: 'zhipuai', apiKey: '', defaultModel: DEFAULT_MODEL }
  },
  agentSystemPrompt: 'You are a helpful AI assistant.',
  loaded: false,

  /** 从主进程加载全部配置，初始化 store 状态 */
  loadSettings: async () => {
    const res = await window.api.getAllConfig()
    if (res.success && res.data) {
      const data = res.data as Record<string, unknown>
      set({
        settings: (data.settings as AppSettings) ?? DEFAULT_SETTINGS,
        providers: (data.providers as Partial<Record<string, ProviderConfig>>) ?? {},
        agentSystemPrompt: (data.agentSystemPrompt as string) ?? 'You are a helpful AI assistant.',
        loaded: true
      })
    } else {
      set({ loaded: true })
    }
  },

  /** 更新应用设置（乐观更新 + 持久化） */
  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    await window.api.setConfig('settings', next)
  },

  /** 更新指定提供商的 API 配置 */
  updateProvider: async (providerId, config) => {
    const next = { ...get().providers, [providerId]: config }
    set({ providers: next })
    await window.api.setConfig('providers', next)
  },

  /** 更新 Agent 全局系统提示 */
  updateAgentSystemPrompt: async (prompt) => {
    set({ agentSystemPrompt: prompt })
    await window.api.setConfig('agentSystemPrompt', prompt)
  },

  /** 获取当前默认提供商的配置 */
  getActiveProviderConfig: () => {
    const { providers } = get()
    return providers[DEFAULT_PROVIDER]
  }
}))
