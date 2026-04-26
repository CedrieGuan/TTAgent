import type { AIProvider, ModelInfo, ProviderDefinition, ProviderCategory } from '../types/ai.types'

/** 提供商注册表：所有支持的 AI 提供商定义 */
export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  // ── 国际云提供商 ─────────────────────────────
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 系列模型',
    category: 'cloud',
    apiType: 'anthropic',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200000, supportsVision: true, supportsTools: true }
    ],
    website: 'https://console.anthropic.com',
    color: '#D97757'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT 系列模型',
    category: 'cloud',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    showBaseUrl: true,
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'o3', name: 'o3', contextWindow: 200000, supportsVision: true, supportsTools: true },
      { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000, supportsVision: true, supportsTools: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsVision: true, supportsTools: true }
    ],
    website: 'https://platform.openai.com',
    color: '#10A37F'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 系列模型',
    category: 'cloud',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000, supportsVision: true, supportsTools: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, supportsVision: true, supportsTools: true }
    ],
    website: 'https://aistudio.google.com',
    color: '#4285F4'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral 系列模型',
    category: 'cloud',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', contextWindow: 128000, supportsVision: false, supportsTools: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', contextWindow: 32000, supportsVision: false, supportsTools: true },
      { id: 'codestral-latest', name: 'Codestral', contextWindow: 256000, supportsVision: false, supportsTools: true }
    ],
    website: 'https://console.mistral.ai',
    color: '#F70000'
  },

  // ── 聚合平台 ──────────────────────────────────
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '多模型聚合路由平台',
    category: 'aggregator',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [],
    website: 'https://openrouter.ai',
    color: '#6D28D9'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: '开源模型推理平台',
    category: 'aggregator',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://api-inference.huggingface.co/v1',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [],
    website: 'https://huggingface.co',
    color: '#FFD21E'
  },

  // ── 国内提供商 ────────────────────────────────
  {
    id: 'zhipuai',
    name: '智谱 AI',
    description: 'GLM 系列模型',
    category: 'chinese',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [
      { id: 'glm-5.1', name: 'GLM-5.1', contextWindow: 200000, supportsVision: false, supportsTools: true },
      { id: 'glm-4.7', name: 'GLM-4.7', contextWindow: 200000, supportsVision: false, supportsTools: true },
      { id: 'glm-4.5-air', name: 'GLM-4.5 Air', contextWindow: 128000, supportsVision: false, supportsTools: true },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash（免费）', contextWindow: 200000, supportsVision: false, supportsTools: true },
      { id: 'glm-4.6v', name: 'GLM-4.6V（视觉）', contextWindow: 128000, supportsVision: true, supportsTools: true }
    ],
    website: 'https://open.bigmodel.cn',
    color: '#3B5FFF'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek 系列模型',
    category: 'chinese',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', contextWindow: 64000, supportsVision: false, supportsTools: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', contextWindow: 64000, supportsVision: false, supportsTools: true }
    ],
    website: 'https://platform.deepseek.com',
    color: '#4D6BFE'
  },
  {
    id: 'modelscope',
    name: '魔搭 ModelScope',
    description: '阿里云模型服务平台',
    category: 'chinese',
    apiType: 'openai-compatible',
    defaultBaseUrl: '',
    requiresApiKey: true,
    showBaseUrl: true,
    models: [],
    website: 'https://modelscope.cn',
    color: '#6236FF'
  },

  // ── 其他 ──────────────────────────────────────
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'NVIDIA 推理微服务',
    category: 'other',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    requiresApiKey: true,
    showBaseUrl: false,
    models: [],
    website: 'https://build.nvidia.com',
    color: '#76B900'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '本地模型运行',
    category: 'other',
    apiType: 'openai-compatible',
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresApiKey: false,
    showBaseUrl: true,
    models: [],
    website: 'https://ollama.ai',
    color: '#000000'
  },
  {
    id: 'custom',
    name: '自定义',
    description: '兼容 OpenAI 接口的自定义端点',
    category: 'other',
    apiType: 'openai-compatible',
    defaultBaseUrl: '',
    requiresApiKey: false,
    showBaseUrl: true,
    models: [],
    website: '',
    color: '#6B7280'
  }
]

/** 按 ID 查找提供商定义 */
export const PROVIDER_MAP = new Map<AIProvider, ProviderDefinition>(
  PROVIDER_REGISTRY.map((p) => [p.id, p])
)

/** 各提供商支持的模型列表（从注册表派生） */
export const PROVIDER_MODELS: Record<string, ModelInfo[]> = {}
for (const p of PROVIDER_REGISTRY) {
  PROVIDER_MODELS[p.id] = p.models
}

/** 提供商显示名称映射（从注册表派生） */
export const PROVIDER_LABELS: Record<string, string> = {}
for (const p of PROVIDER_REGISTRY) {
  PROVIDER_LABELS[p.id] = p.name
}

/** 分类显示名称 */
export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  cloud: '国际提供商',
  aggregator: '聚合平台',
  chinese: '国内提供商',
  other: '其他'
}

/** 分类排序顺序 */
export const CATEGORY_ORDER: ProviderCategory[] = ['cloud', 'aggregator', 'chinese', 'other']

/** 智谱 AI 的 API 基础地址（保持向后兼容） */
export const ZHIPUAI_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4'

/** 默认提供商和模型 */
export const DEFAULT_PROVIDER: AIProvider = 'zhipuai'
export const DEFAULT_MODEL = 'glm-5.1'
