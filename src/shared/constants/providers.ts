import type { AIProvider, ModelInfo } from '../types/ai.types'

export const PROVIDER_MODELS: Record<AIProvider, ModelInfo[]> = {
  anthropic: [
    {
      id: 'claude-opus-4-5',
      name: 'Claude Opus 4.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'claude-sonnet-4-5',
      name: 'Claude Sonnet 4.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'claude-haiku-3-5',
      name: 'Claude Haiku 3.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    }
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      contextWindow: 200000,
      supportsVision: false,
      supportsTools: true
    }
  ],
  zhipuai: [
    {
      id: 'glm-4-plus',
      name: 'GLM-4 Plus',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4',
      name: 'GLM-4',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4-air',
      name: 'GLM-4 Air',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4-flash',
      name: 'GLM-4 Flash（免费）',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4v-plus',
      name: 'GLM-4V Plus（视觉）',
      contextWindow: 8000,
      supportsVision: true,
      supportsTools: false
    },
    {
      id: 'codegeex-4',
      name: 'CodeGeeX-4（代码）',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    }
  ],
  ollama: [],
  custom: []
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  zhipuai: '智谱 AI（ZhipuAI）',
  ollama: 'Ollama (本地)',
  custom: '自定义'
}

export const ZHIPUAI_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

export const DEFAULT_PROVIDER: AIProvider = 'anthropic'
export const DEFAULT_MODEL = 'claude-sonnet-4-5'
