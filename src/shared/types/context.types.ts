import type { ChatMessage } from './ai.types'

// ── Token Budget ─────────────────────────────────────────────

export interface TokenBudget {
  /** Total context window for the model */
  totalContextWindow: number
  /** Tokens reserved for model response */
  responseReserve: number
  /** Safety margin for counting inaccuracies */
  safetyMargin: number
  /** Headroom for agent-loop tool chain growth */
  agentLoopHeadroom: number
  /** Computed: tokens available for input (prompt + history + tools) */
  usableInputBudget: number
}

// ── Conversation Turns ───────────────────────────────────────

export interface ConversationTurn {
  /** Unique ID derived from first message in the turn */
  id: string
  /** Index range in original flat ChatMessage[] */
  startIndex: number
  endIndex: number
  /** Messages belonging to this turn (references to original array) */
  messages: ChatMessage[]
  /** Whether this turn contains tool call/result chains */
  hasToolChain: boolean
  /** Estimated token count for this turn */
  tokenEstimate: number
  /** True if this is the most recent (active) turn */
  isCurrentTurn: boolean
}

// ── Context Strategy Config ──────────────────────────────────

export interface ContextStrategyConfig {
  /** Enable/disable context management (default: true) */
  enabled: boolean
  /** Soft threshold ratio to start managing (default: 0.75) */
  softThreshold: number
  /** Hard threshold ratio where management is mandatory (default: 0.90) */
  hardThreshold: number
  /** Max tokens for a single message before offloading (default: 8000) */
  offloadThreshold: number
  /** Max tokens for the summary message (default: 15000) */
  maxSummaryTokens: number
  /** Model to use for summarization (auto-resolved to cheapest) */
  summaryModel?: string
  /** Summary provider (auto-resolved to cheapest available) */
  summaryProvider?: string
}

export const DEFAULT_CONTEXT_STRATEGY_CONFIG: ContextStrategyConfig = {
  enabled: true,
  softThreshold: 0.75,
  hardThreshold: 0.9,
  offloadThreshold: 8000,
  maxSummaryTokens: 15000
}

// ── Context Events ───────────────────────────────────────────

export type ContextEventType =
  | 'context_warning' // Approaching limit
  | 'context_offloaded' // Long message offloaded
  | 'context_truncated' // Old turns removed
  | 'context_summary_started' // Summarization in progress
  | 'context_summary_completed' // Summary created
  | 'context_summary_failed' // Summarization failed, fell back to truncation
  | 'context_budget_info' // Token budget info for UI

export interface ContextEvent {
  type: ContextEventType
  sessionId: string
  timestamp: number
  /** Human-readable description (for UI display) */
  message: string
  /** Numeric data payload (token counts, percentages, etc.) */
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

// ── Strategy Result ──────────────────────────────────────────

export interface ContextManagerResult {
  /** Trimmed message array (safe to send to LLM) */
  messages: ChatMessage[]
  /** Events emitted during strategy execution */
  events: ContextEvent[]
  /** Token budget breakdown */
  budget: TokenBudget
  /** Total estimated tokens of the result */
  totalTokens: number
  /** Whether any strategy was applied */
  wasManaged: boolean
}
