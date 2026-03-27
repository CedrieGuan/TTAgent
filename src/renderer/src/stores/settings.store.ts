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
  providers: Partial<Record<string, ProviderConfig>>
  agentSystemPrompt: string
  loaded: boolean

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  updateProvider: (providerId: string, config: ProviderConfig) => Promise<void>
  updateAgentSystemPrompt: (prompt: string) => Promise<void>
  getActiveProviderConfig: () => ProviderConfig | undefined
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'zh',
  fontSize: 14,
  sendOnEnter: true
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  providers: {
    anthropic: { provider: DEFAULT_PROVIDER, apiKey: '', defaultModel: DEFAULT_MODEL },
    zhipuai: { provider: 'zhipuai', apiKey: '', defaultModel: 'glm-4-plus' }
  },
  agentSystemPrompt: 'You are a helpful AI assistant.',
  loaded: false,

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

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    await window.api.setConfig('settings', next)
  },

  updateProvider: async (providerId, config) => {
    const next = { ...get().providers, [providerId]: config }
    set({ providers: next })
    await window.api.setConfig('providers', next)
  },

  updateAgentSystemPrompt: async (prompt) => {
    set({ agentSystemPrompt: prompt })
    await window.api.setConfig('agentSystemPrompt', prompt)
  },

  getActiveProviderConfig: () => {
    const { providers } = get()
    return providers[DEFAULT_PROVIDER]
  }
}))
