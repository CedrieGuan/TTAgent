import type { AIProvider, ModelInfo } from '../types/ai.types'

/** 各提供商支持的模型列表 */
export const PROVIDER_MODELS: Record<AIProvider, ModelInfo[]> = {
  anthropic: [
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      contextWindow: 1000000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      contextWindow: 1000000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    }
  ],
  openai: [
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      contextWindow: 1000000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
      contextWindow: 1000000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'o3',
      name: 'o3',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'o4-mini',
      name: 'o4-mini',
      contextWindow: 200000,
      supportsVision: true,
      supportsTools: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      supportsVision: true,
      supportsTools: true
    }
  ],
  zhipuai: [
    {
      id: 'glm-5.1',
      name: 'GLM-5.1',
      contextWindow: 200000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4.7',
      name: 'GLM-4.7',
      contextWindow: 200000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4.5-air',
      name: 'GLM-4.5 Air',
      contextWindow: 128000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4.7-flash',
      name: 'GLM-4.7 Flash（免费）',
      contextWindow: 200000,
      supportsVision: false,
      supportsTools: true
    },
    {
      id: 'glm-4.6v',
      name: 'GLM-4.6V（视觉）',
      contextWindow: 128000,
      supportsVision: true,
      supportsTools: true
    }
  ],
  ollama: [],
  custom: []
}

/** 提供商显示名称映射 */
export const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  zhipuai: '智谱 AI（ZhipuAI）',
  ollama: 'Ollama (本地)',
  custom: '自定义'
}

/** 智谱 AI 的 API 基础地址 */
export const ZHIPUAI_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4'

/** 默认提供商和模型 */
export const DEFAULT_PROVIDER: AIProvider = 'zhipuai'
export const DEFAULT_MODEL = 'glm-5.1'
