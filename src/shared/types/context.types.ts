import type { ChatMessage } from './ai.types'

// ── Token 预算 ────────────────────────────────────────────────

/** 上下文 Token 预算分配明细 */
export interface TokenBudget {
  /** 模型总上下文窗口大小 */
  totalContextWindow: number
  /** 为模型响应预留的 token 数 */
  responseReserve: number
  /** 计数误差安全边距 */
  safetyMargin: number
  /** Agent 循环工具链增长预留空间 */
  agentLoopHeadroom: number
  /** 可用于输入的 token 预算（提示 + 历史 + 工具定义） */
  usableInputBudget: number
}

// ── 对话轮次 ──────────────────────────────────────────────────

/** 一个完整的对话轮次（用户消息 + 对应的 AI 回复 + 工具调用链） */
export interface ConversationTurn {
  /** 由轮次首条消息 ID 派生的唯一标识 */
  id: string
  /** 在原始 ChatMessage[] 中的起始索引 */
  startIndex: number
  endIndex: number
  /** 属于本轮次的消息列表（引用原始数组） */
  messages: ChatMessage[]
  /** 本轮次是否包含工具调用链 */
  hasToolChain: boolean
  /** 本轮次的估算 token 数 */
  tokenEstimate: number
  /** 是否为最新（当前）轮次 */
  isCurrentTurn: boolean
}

// ── 上下文策略配置 ────────────────────────────────────────────

/** 上下文管理策略配置项 */
export interface ContextStrategyConfig {
  /** 是否启用上下文管理（默认 true） */
  enabled: boolean
  /** 开始管理的软阈值比例（默认 0.75） */
  softThreshold: number
  /** 强制管理的硬阈值比例（默认 0.90） */
  hardThreshold: number
  /** 单条消息触发卸载的 token 上限（默认 8000） */
  offloadThreshold: number
  /** 摘要消息的最大 token 数（默认 15000） */
  maxSummaryTokens: number
  /** 摘要使用的模型（自动解析为最便宜的可用模型） */
  summaryModel?: string
  /** 摘要使用的提供商（自动解析） */
  summaryProvider?: string
}

export const DEFAULT_CONTEXT_STRATEGY_CONFIG: ContextStrategyConfig = {
  enabled: true,
  softThreshold: 0.75,
  hardThreshold: 0.9,
  offloadThreshold: 8000,
  maxSummaryTokens: 15000
}

// ── 上下文事件 ────────────────────────────────────────────────

/** 上下文管理事件类型 */
export type ContextEventType =
  | 'context_warning'           // 接近上下文限制
  | 'context_offloaded'         // 长消息已卸载
  | 'context_truncated'         // 旧轮次已截断
  | 'context_summary_started'   // 摘要生成中
  | 'context_summary_completed' // 摘要生成完成
  | 'context_summary_failed'    // 摘要失败，回退到截断
  | 'context_budget_info'       // Token 预算信息（用于 UI 展示）

/** 上下文管理事件（通过 IPC 推送到渲染进程） */
export interface ContextEvent {
  type: ContextEventType
  sessionId: string
  timestamp: number
  /** 人类可读的描述（用于 UI 展示） */
  message: string
  /** 数值数据载荷（token 数、百分比等） */
  data?: {
    totalTokens?: number
    budgetTokens?: number
    usagePercent?: number
    messagesAffected?: number
    tokensSaved?: number
    turnsRemoved?: number
    turnsSummarized?: number
  }
}

// ── 策略执行结果 ──────────────────────────────────────────────

/** 上下文管理器的执行结果 */
export interface ContextManagerResult {
  /** 经过裁剪后可安全发送给 LLM 的消息列表 */
  messages: ChatMessage[]
  /** 策略执行过程中产生的事件列表 */
  events: ContextEvent[]
  /** Token 预算分配明细 */
  budget: TokenBudget
  /** 结果消息列表的估算总 token 数 */
  totalTokens: number
  /** 是否执行了任何上下文管理策略 */
  wasManaged: boolean
}
