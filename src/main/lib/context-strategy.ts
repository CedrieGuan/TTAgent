/**
 * 上下文管理策略模块
 * 负责在 token 超出预算时对消息历史进行裁剪、卸载或摘要压缩
 *
 * 策略执行顺序：
 * 1. 计算 token 预算，若低于软阈值则直接放行
 * 2. Pass 1：卸载超大消息（替换为占位摘要）
 * 3. Pass 2：截断最旧的对话轮次，直到满足硬阈值
 */
import type { ProviderConfig } from '@shared/types/ai.types'
import type { ChatMessage } from '@shared/types/ai.types'
import type { MCPTool } from '@shared/types/mcp.types'
import type {
  ContextStrategyConfig,
  ContextManagerResult,
  ContextEvent,
  ConversationTurn
} from '@shared/types/context.types'
import { DEFAULT_CONTEXT_STRATEGY_CONFIG } from '@shared/types/context.types'
import {
  countMessageTokens,
  countMessagesTokens,
  countTextTokens,
  estimateSystemPromptTokens,
  estimateToolSchemaTokens,
  calculateBudget
} from './token-counter'
import { deriveTurns, flattenTurns } from './context-turns'
import { createEvent } from './context-events'
import { store } from '../store'
import OpenAI from 'openai'
import { ZHIPUAI_BASE_URL } from '@shared/constants/providers'

/** 格式化 token 数为可读字符串（K/M 单位） */
function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

interface ContextManagerOpts {
  sessionId: string
  messages: ChatMessage[]
  systemPrompt?: string
  contextWindow: number
  maxTokens: number
  tools: MCPTool[]
  config?: Partial<ContextStrategyConfig>
}

/**
 * 主入口：管理上下文，返回裁剪后的消息列表和事件
 */
export function manageContext(opts: ContextManagerOpts): ContextManagerResult {
  const config: ContextStrategyConfig = {
    ...DEFAULT_CONTEXT_STRATEGY_CONFIG,
    ...opts.config
  }

  if (!config.enabled) {
    return passThrough(opts)
  }

  const events: ContextEvent[] = []
  const budget = calculateBudget(opts.contextWindow, opts.maxTokens, opts.tools.length > 0)

  // 计算系统提示和工具定义占用的固定 token 开销
  const fixedOverhead =
    estimateSystemPromptTokens(opts.systemPrompt) + estimateToolSchemaTokens(opts.tools.length)
  const availableForHistory = budget.usableInputBudget - fixedOverhead

  if (availableForHistory <= 0) {
    events.push(
      createEvent('context_warning', opts.sessionId, '上下文预算不足以容纳系统提示和工具定义', {
        totalTokens: fixedOverhead,
        budgetTokens: budget.usableInputBudget
      })
    )
    return { messages: opts.messages, events, budget, totalTokens: 0, wasManaged: false }
  }

  let turns = deriveTurns(opts.messages)

  // 为每个轮次估算 token 数
  for (const turn of turns) {
    turn.tokenEstimate = countMessagesTokens(turn.messages)
  }

  let currentTotal = turns.reduce((sum, t) => sum + t.tokenEstimate, 0)

  // 低于软阈值：无需管理，直接返回并上报预算信息
  if (currentTotal <= availableForHistory * config.softThreshold) {
    const usagePercent = Math.round(
      ((currentTotal + fixedOverhead) / budget.usableInputBudget) * 100
    )
    events.push(
      createEvent(
        'context_budget_info',
        opts.sessionId,
        `上下文使用 ${usagePercent}%（${formatTokenCount(currentTotal + fixedOverhead)} / ${formatTokenCount(budget.usableInputBudget)}）`,
        {
          totalTokens: currentTotal + fixedOverhead,
          budgetTokens: budget.usableInputBudget,
          usagePercent
        }
      )
    )
    return {
      messages: opts.messages,
      events,
      budget,
      totalTokens: currentTotal + fixedOverhead,
      wasManaged: false
    }
  }

  events.push(
    createEvent(
      'context_warning',
      opts.sessionId,
      `上下文使用率 ${Math.round(((currentTotal + fixedOverhead) / budget.usableInputBudget) * 100)}%，开始管理上下文`,
      {
        totalTokens: currentTotal + fixedOverhead,
        budgetTokens: budget.usableInputBudget,
        usagePercent: Math.round(((currentTotal + fixedOverhead) / budget.usableInputBudget) * 100)
      }
    )
  )

  // Pass 1：卸载超大消息（将内容替换为占位摘要）
  turns = applyOffloading(turns, config.offloadThreshold, opts.sessionId, events)
  currentTotal = turns.reduce((sum, t) => sum + t.tokenEstimate, 0)

  // Pass 2：截断最旧的轮次，直到满足硬阈值
  const hardLimit = availableForHistory * config.hardThreshold
  if (currentTotal > hardLimit) {
    turns = applyTruncation(turns, hardLimit, opts.sessionId, events)
    currentTotal = turns.reduce((sum, t) => sum + t.tokenEstimate, 0)
  }

  const finalMessages = flattenTurns(turns)
  const totalTokens = currentTotal + fixedOverhead

  return { messages: finalMessages, events, budget, totalTokens, wasManaged: true }
}

/** 不做任何管理，直接透传（上下文管理被禁用时使用） */
function passThrough(opts: ContextManagerOpts): ContextManagerResult {
  const budget = calculateBudget(opts.contextWindow, opts.maxTokens, opts.tools.length > 0)
  const totalTokens =
    countMessagesTokens(opts.messages) +
    estimateSystemPromptTokens(opts.systemPrompt) +
    estimateToolSchemaTokens(opts.tools.length)
  return { messages: opts.messages, events: [], budget, totalTokens, wasManaged: false }
}

/**
 * Pass 1：卸载超大消息
 * 将非当前轮次中超过 offloadThreshold 的消息内容替换为占位摘要
 */
function applyOffloading(
  turns: ConversationTurn[],
  offloadThreshold: number,
  sessionId: string,
  events: ContextEvent[]
): ConversationTurn[] {
  let offloadedCount = 0
  let tokensSaved = 0

  const result = turns.map((turn) => ({
    ...turn,
    messages: turn.messages.map((msg) => {
      const tokens = countMessageTokens(msg)
      // 未超阈值或属于当前轮次则跳过
      if (tokens <= offloadThreshold) return msg
      if (turn.isCurrentTurn) return msg

      const originalLength = msg.content.length
      const summary = msg.content.slice(0, 200)
      const placeholder = `[内容已卸载: 原始 ${originalLength} 字符]\n摘要: ${summary}...`

      offloadedCount++
      tokensSaved += tokens - countTextTokens(placeholder)

      return { ...msg, content: placeholder } as ChatMessage
    })
  }))

  if (offloadedCount > 0) {
    events.push(
      createEvent('context_offloaded', sessionId, `已卸载 ${offloadedCount} 条长消息`, {
        messagesAffected: offloadedCount,
        tokensSaved
      })
    )
  }

  // 重新计算各轮次的 token 估算值
  for (const turn of result) {
    turn.tokenEstimate = countMessagesTokens(turn.messages)
  }

  return result
}

/**
 * Pass 2：截断最旧的对话轮次
 * 保留当前轮次（受保护），从最旧的可移除轮次开始丢弃，直到满足 targetBudget
 */
function applyTruncation(
  turns: ConversationTurn[],
  targetBudget: number,
  sessionId: string,
  events: ContextEvent[]
): ConversationTurn[] {
  const protectedTurns: ConversationTurn[] = []
  const removableTurns: ConversationTurn[] = []

  for (const turn of turns) {
    if (turn.isCurrentTurn) {
      protectedTurns.push(turn)
    } else {
      removableTurns.push(turn)
    }
  }

  const currentProtectedTokens = protectedTurns.reduce((sum, t) => sum + t.tokenEstimate, 0)
  const budgetForRemovable = targetBudget - currentProtectedTokens

  if (budgetForRemovable <= 0) {
    // 当前轮次本身已超出预算，只能保留当前轮次
    events.push(
      createEvent('context_warning', sessionId, '当前对话轮次已超出预算', {
        totalTokens: currentProtectedTokens,
        budgetTokens: targetBudget
      })
    )
    return protectedTurns
  }

  const kept: ConversationTurn[] = []
  let accumulated = 0

  // 从最新的可移除轮次开始保留，尽量保留更多近期历史
  for (let i = removableTurns.length - 1; i >= 0; i--) {
    const turn = removableTurns[i]
    if (accumulated + turn.tokenEstimate <= budgetForRemovable) {
      kept.unshift(turn)
      accumulated += turn.tokenEstimate
    }
  }

  const removedCount = removableTurns.length - kept.length
  if (removedCount > 0) {
    events.push(
      createEvent('context_truncated', sessionId, `已截断 ${removedCount} 轮旧对话`, {
        turnsRemoved: removedCount,
        tokensSaved: removableTurns.slice(0, removedCount).reduce((s, t) => s + t.tokenEstimate, 0)
      })
    )
  }

  return [...kept, ...protectedTurns]
}

/**
 * 摘要压缩：将多个旧轮次调用 LLM 生成摘要，替换为单条 system 消息
 * 失败时自动回退到截断策略
 */
export async function summarizeTurns(
  turns: ConversationTurn[],
  sessionId: string,
  events: ContextEvent[]
): Promise<ConversationTurn[]> {
  const removableTurns = turns.filter((t) => !t.isCurrentTurn)
  if (removableTurns.length < 2) return turns

  events.push(
    createEvent('context_summary_started', sessionId, `正在总结 ${removableTurns.length} 轮旧对话...`)
  )

  try {
    const summaryText = buildSummarizationPrompt(removableTurns)
    const summaryContent = await callSummaryLLM(summaryText)

    if (!summaryContent) {
      events.push(createEvent('context_summary_failed', sessionId, '摘要生成失败，回退到截断策略'))
      return turns
    }

    // 将摘要包装为一个虚拟轮次
    const summaryTurn: ConversationTurn = {
      id: `summary-${Date.now()}`,
      startIndex: -1,
      endIndex: -1,
      messages: [
        {
          id: `summary-msg-${Date.now()}`,
          role: 'system',
          content: `[对话历史摘要]\n${summaryContent}`,
          timestamp: Date.now()
        }
      ],
      hasToolChain: false,
      tokenEstimate: countTextTokens(summaryContent) + 10,
      isCurrentTurn: false
    }

    const protectedTurns = turns.filter((t) => t.isCurrentTurn)
    const result = [summaryTurn, ...protectedTurns]

    events.push(
      createEvent('context_summary_completed', sessionId, `已将 ${removableTurns.length} 轮对话压缩为摘要`, {
        turnsSummarized: removableTurns.length,
        tokensSaved:
          removableTurns.reduce((s, t) => s + t.tokenEstimate, 0) - summaryTurn.tokenEstimate
      })
    )

    return result
  } catch {
    events.push(createEvent('context_summary_failed', sessionId, '摘要生成出错，回退到截断策略'))
    return turns
  }
}

/** 构建发送给 LLM 的摘要生成提示词 */
function buildSummarizationPrompt(turns: ConversationTurn[]): string {
  const parts = turns.map((turn) => {
    const userMsg = turn.messages.find(
      (m) => m.role === 'user' && !(m as unknown as Record<string, unknown>)._anthropicToolResults
    )
    const assistantMsgs = turn.messages.filter((m) => m.role === 'assistant')
    const userText = userMsg?.content ?? ''
    const assistantText = assistantMsgs.map((m) => m.content).filter(Boolean).join('\n')
    return `用户: ${userText.slice(0, 200)}\n助手: ${assistantText.slice(0, 300)}`
  })

  return `请将以下多轮对话历史压缩为一段简洁的摘要，保留关键信息、用户意图和重要结论。用中文回复。

对话历史:
${parts.join('\n\n---\n\n')}

摘要:`
}

/**
 * 调用 LLM 生成摘要
 * 按优先级选择最便宜的可用提供商：智谱 AI > OpenAI > Anthropic
 */
async function callSummaryLLM(prompt: string): Promise<string | null> {
  const providers = store.get('providers') ?? {}
  const cheapest = findCheapestProvider(providers)
  if (!cheapest) return null

  const { provider, config } = cheapest

  try {
    if (provider === 'zhipuai') {
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: ZHIPUAI_BASE_URL })
      const response = await client.chat.completions.create({
        model: config.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        stream: false
      })
      return response.choices[0]?.message?.content ?? null
    }

    if (provider === 'openai') {
      const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
      const response = await client.chat.completions.create({
        model: config.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        stream: false
      })
      return response.choices[0]?.message?.content ?? null
    }

    if (provider === 'anthropic') {
      const AnthropicSDK = await import('@anthropic-ai/sdk')
      const client = new AnthropicSDK.default({ apiKey: config.apiKey })
      const response = await client.messages.create({
        model: config.defaultModel,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
      const textBlock = response.content.find((b) => b.type === 'text')
      return textBlock && 'text' in textBlock ? textBlock.text : null
    }

    return null
  } catch {
    return null
  }
}

/**
 * 按优先级查找最便宜的已配置提供商
 * 优先级：智谱 AI > OpenAI > Anthropic > 其他
 */
function findCheapestProvider(
  providers: Partial<Record<string, ProviderConfig>>
): { provider: string; config: ProviderConfig } | null {
  const priority = ['zhipuai', 'openai', 'anthropic']

  for (const p of priority) {
    const config = providers[p]
    if (config?.apiKey) {
      return { provider: p, config }
    }
  }

  for (const [key, config] of Object.entries(providers)) {
    if (config?.apiKey) {
      return { provider: key, config }
    }
  }

  return null
}

/**
 * Agent 循环中间检查：在每次工具调用后检查上下文是否超出预算
 * 若超出硬阈值则立即截断，避免后续迭代失败
 */
export function applyMidLoopCheck(
  currentMessages: ChatMessage[],
  contextWindow: number,
  maxTokens: number,
  hasTools: boolean,
  sessionId: string
): { messages: ChatMessage[]; events: ContextEvent[] } {
  const budget = calculateBudget(contextWindow, maxTokens, hasTools)
  const currentTokens = countMessagesTokens(currentMessages)

  // 未超出硬阈值，无需处理
  if (currentTokens <= budget.usableInputBudget * DEFAULT_CONTEXT_STRATEGY_CONFIG.hardThreshold) {
    return { messages: currentMessages, events: [] }
  }

  const events: ContextEvent[] = []
  const turns = deriveTurns(currentMessages)
  for (const turn of turns) {
    turn.tokenEstimate = countMessagesTokens(turn.messages)
  }

  const hardLimit = budget.usableInputBudget * DEFAULT_CONTEXT_STRATEGY_CONFIG.hardThreshold
  const managed = applyTruncation(turns, hardLimit, sessionId, events)

  for (const turn of managed) {
    turn.tokenEstimate = countMessagesTokens(turn.messages)
  }

  return { messages: flattenTurns(managed), events }
}
