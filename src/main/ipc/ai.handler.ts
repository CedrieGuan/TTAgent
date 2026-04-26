/**
 * AI 对话 IPC Handler
 * 核心模块：处理多提供商流式对话、工具调用循环（Agent Loop）和上下文管理
 *
 * 支持的提供商：Anthropic、OpenAI、智谱 AI（OpenAI 兼容接口）
 * Agent Loop 最大迭代次数：15 次
 */
import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { PROVIDER_MAP, PROVIDER_MODELS } from '@shared/constants/providers'
import { persistMessage } from './session.handler'
import { mcpClients } from './mcp.handler'
import { ToolRouter } from '../tools/tool-router'
import { toAnthropicTools, toOpenAITools } from '../tools/tool-schema'
import type { AIRequestPayload, AIStreamChunk, IPCResponse } from '@shared/types/ipc.types'
import type { ChatMessage, Attachment, AIProvider } from '@shared/types/ai.types'
import type { MCPTool } from '@shared/types/mcp.types'
import { manageContext, applyMidLoopCheck } from '../lib/context-strategy'
import { emitContextEvent, createEvent } from '../lib/context-events'
import { countMessagesTokens, calculateBudget } from '../lib/token-counter'
import { memoryManager } from '../memory/memory-manager'
import { logger } from '../logger'

/** 活跃的流式请求 AbortController（sessionId -> controller） */
const activeStreams = new Map<string, AbortController>()

/** Agent Loop 最大迭代次数，防止无限循环 */
const MAX_AGENT_ITERATIONS = 15

/** 执行前需要用户确认的危险工具集合 */
const DANGEROUS_TOOLS = new Set(['local_shell_execute', 'local_write_file'])

/** 待处理的工具确认请求（confirmId -> resolve 回调） */
const pendingConfirms = new Map<string, (response: 'allow' | 'reject' | 'always_allow') => void>()

/** 每个会话中用户已授权"始终允许"的工具集合（sessionId -> Set<toolName>） */
const sessionAlwaysAllowed = new Map<string, Set<string>>()

/** 单次流式调用的返回结果 */
interface StreamResult {
  fullContent: string
  toolCalls: ParsedToolCall[]
}

/** 解析后的工具调用 */
interface ParsedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export function registerAIHandlers(): void {
  /**
   * 主处理器：接收用户消息，执行 Agent Loop
   * 流程：上下文管理 -> 流式调用 LLM -> 执行工具 -> 循环直到无工具调用
   */
  ipcMain.handle(
    IPC_CHANNELS.AI_SEND_MESSAGE,
    async (event, payload: AIRequestPayload): Promise<IPCResponse> => {
      const {
        sessionId,
        messages,
        provider,
        model,
        systemPrompt,
        maxTokens = 4096,
        mcpTools
      } = payload
      const sender = event.sender

      const abortController = new AbortController()
      activeStreams.set(sessionId, abortController)

      // 持久化用户消息
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        persistMessage(sessionId, lastMessage)
      }

      const allTools = mcpTools ?? []
      const toolRouter = new ToolRouter(mcpClients)

      // 在 try 外声明，供 finally 块访问（触发记忆提取）
      let agentMessages: ChatMessage[] = []

      try {
        const contextWindow = getContextWindow(provider, model)

        // 初始上下文管理：裁剪历史消息以适应 token 预算
        const ctxResult = manageContext({
          sessionId,
          messages,
          contextWindow,
          maxTokens,
          tools: allTools
        })

        for (const evt of ctxResult.events) {
          emitContextEvent(sender, evt)
        }

        agentMessages = [...ctxResult.messages]
        let finalContent = ''

        // Agent Loop：最多迭代 MAX_AGENT_ITERATIONS 次
        for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
          if (abortController.signal.aborted) break

          // 非首次迭代：检查工具调用后上下文是否超出预算
          if (iteration > 0) {
            const midCheck = applyMidLoopCheck(
              agentMessages,
              contextWindow,
              maxTokens,
              allTools.length > 0,
              sessionId
            )
            for (const evt of midCheck.events) {
              emitContextEvent(sender, evt)
            }
            if (midCheck.messages !== agentMessages) {
              agentMessages.length = 0
              agentMessages.push(...midCheck.messages)
            }
          }

          // 调用 LLM，获取文本内容和工具调用列表
          const result = await streamWithTools({
            sender,
            sessionId,
            messages: agentMessages,
            provider,
            model,
            systemPrompt,
            maxTokens,
            signal: abortController.signal,
            allTools,
            toolRouter
          })

          finalContent = result.fullContent

          // 无工具调用：对话结束，退出循环
          if (result.toolCalls.length === 0) {
            break
          }

          // 执行所有工具调用
          const toolResults = await executeToolCalls(
            sender,
            sessionId,
            result.toolCalls,
            toolRouter,
            abortController.signal
          )

          // 将本轮 assistant 消息（含工具调用）追加到历史并持久化
          const assistantMsg: ChatMessage = {
            id: `${Date.now()}-assistant-${iteration}`,
            role: 'assistant',
            content: result.fullContent,
            toolCalls: result.toolCalls.map((tc, i) => ({
              id: tc.id,
              name: tc.name,
              input: tc.input,
              status: 'success' as const,
              result: toolResults[i]?.output
            })),
            timestamp: Date.now()
          }
          agentMessages.push(assistantMsg)
          persistMessage(sessionId, assistantMsg)

          // 通知渲染进程：本轮 agent 消息已完成（用于 UI 展示工具调用结果）
          const agentMsgChunk: AIStreamChunk = {
            type: 'agent_message',
            sessionId,
            agentMessage: assistantMsg
          }
          if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, agentMsgChunk)

          // 将工具结果追加到历史（格式因提供商而异）
          const toolResultMsgs = buildToolResultMessages(provider, toolResults)
          for (const trMsg of toolResultMsgs) {
            agentMessages.push(trMsg)
          }
        }

        // 持久化最终的纯文本 assistant 消息（无工具调用的最后一轮）
        if (finalContent) {
          const existingAssistant = agentMessages.filter(
            (m) =>
              m.role === 'assistant' &&
              m.content === finalContent &&
              m.toolCalls &&
              m.toolCalls.length > 0
          )
          if (existingAssistant.length === 0) {
            const assistantMsg: ChatMessage = {
              id: `${Date.now()}-assistant-final`,
              role: 'assistant',
              content: finalContent,
              timestamp: Date.now()
            }
            persistMessage(sessionId, assistantMsg)
          }
        }

        // 上报最终的上下文使用情况
        {
          const budget = calculateBudget(contextWindow, maxTokens, allTools.length > 0)
          const totalTokens = countMessagesTokens(agentMessages)
          const usagePercent = Math.round((totalTokens / budget.usableInputBudget) * 100)
          emitContextEvent(
            sender,
            createEvent(
              'context_budget_info',
              sessionId,
              `上下文使用 ${usagePercent}%（${fmtTk(totalTokens)} / ${fmtTk(budget.usableInputBudget)}）`,
              { totalTokens, budgetTokens: budget.usableInputBudget, usagePercent }
            )
          )
        }

        return { success: true }
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') {
          return { success: true, data: 'cancelled' }
        }
        const error = err instanceof Error ? err.message : String(err)
        const chunk: AIStreamChunk = { type: 'error', sessionId, error }
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk)
        return { success: false, error }
      } finally {
        activeStreams.delete(sessionId)
        // 无论成功或失败，都发送 stop 信号通知渲染进程流已结束
        const stopChunk: AIStreamChunk = { type: 'stop', sessionId }
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, stopChunk)

        // 异步触发记忆提取（fire-and-forget，不阻塞主对话流程）
        if (agentMessages.length >= 2 && !abortController.signal.aborted) {
          const workspacePath = store.get('memoryWorkspacePath') || undefined
          memoryManager
            .extractAndUpdateMemories({
              sessionId,
              messages: agentMessages,
              provider,
              model,
              workspacePath,
              sender: sender.isDestroyed() ? undefined : sender
            })
            .catch((err) => logger.ai.error('记忆提取异常:', err))
        }
      }
    }
  )

  /** 取消指定会话的流式请求 */
  ipcMain.on(IPC_CHANNELS.AI_CANCEL_STREAM, (_event, sessionId: string) => {
    activeStreams.get(sessionId)?.abort()
    activeStreams.delete(sessionId)
  })

  /** 接收渲染进程的工具确认响应，解除对应的 pending Promise */
  ipcMain.on(
    IPC_CHANNELS.AI_TOOL_CONFIRM_RESPONSE,
    (_event, payload: { confirmId: string; response: 'allow' | 'reject' | 'always_allow' }) => {
      const resolve = pendingConfirms.get(payload.confirmId)
      if (resolve) {
        pendingConfirms.delete(payload.confirmId)
        resolve(payload.response)
      }
    }
  )
}

/**
 * 顺序执行工具调用列表
 * 危险工具（shell 执行、写文件）在执行前向渲染进程发起用户确认请求
 * 每次调用前后都向渲染进程发送状态更新
 */
async function executeToolCalls(
  sender: Electron.WebContents,
  sessionId: string,
  toolCalls: ParsedToolCall[],
  toolRouter: ToolRouter,
  signal: AbortSignal
): Promise<{ id: string; output: string; isError: boolean }[]> {
  const results: { id: string; output: string; isError: boolean }[] = []

  for (const tc of toolCalls) {
    if (signal.aborted) break

    // 危险工具：执行前请求用户确认
    if (DANGEROUS_TOOLS.has(tc.name)) {
      const confirmId = `${sessionId}-${tc.id}-${Date.now()}`
      const decision = await requestToolConfirmation(
        sender,
        sessionId,
        confirmId,
        tc.name,
        tc.input,
        signal
      )

      if (decision === 'reject') {
        // 用户拒绝：将拒绝结果加入列表，跳过实际执行
        const rejectOutput = '[用户已拒绝此操作]'
        const rejectChunk: AIStreamChunk = {
          type: 'tool_result',
          sessionId,
          toolCallId: tc.id,
          toolName: tc.name,
          toolOutput: rejectOutput,
          toolIsError: true
        }
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, rejectChunk)
        results.push({ id: tc.id, output: rejectOutput, isError: true })
        continue
      }
    }

    // 通知渲染进程：工具调用开始
    const startChunk: AIStreamChunk = {
      type: 'tool_use_start',
      sessionId,
      toolCallId: tc.id,
      toolName: tc.name,
      toolInput: tc.input
    }
    if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, startChunk)

    const result = await toolRouter.executeTool(tc.name, tc.input)

    // 通知渲染进程：工具调用结果
    const resultChunk: AIStreamChunk = {
      type: 'tool_result',
      sessionId,
      toolCallId: tc.id,
      toolName: tc.name,
      toolOutput: result.output,
      toolIsError: result.isError
    }
    if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, resultChunk)

    results.push({ id: tc.id, output: result.output, isError: result.isError })
  }

  return results
}

/**
 * 向渲染进程发送工具确认请求，等待用户响应
 * 若 AbortSignal 触发则自动返回 'reject'（取消流时防止死锁）
 */
async function requestToolConfirmation(
  sender: Electron.WebContents,
  sessionId: string,
  confirmId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  signal: AbortSignal
): Promise<'allow' | 'reject'> {
  // 检查是否已授权"始终允许"
  if (sessionAlwaysAllowed.get(sessionId)?.has(toolName)) {
    return 'allow'
  }

  // 向渲染进程发送确认请求
  const confirmChunk: AIStreamChunk = {
    type: 'tool_confirm_request',
    sessionId,
    confirmId,
    toolName,
    toolInput
  }
  if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, confirmChunk)

  return new Promise<'allow' | 'reject'>((resolve) => {
    // 流被取消时自动拒绝，防止 Promise 永久挂起
    const abortHandler = () => {
      pendingConfirms.delete(confirmId)
      resolve('reject')
    }
    signal.addEventListener('abort', abortHandler, { once: true })

    pendingConfirms.set(confirmId, (response) => {
      signal.removeEventListener('abort', abortHandler)
      if (response === 'always_allow') {
        // 记录"始终允许"，本会话内后续不再询问
        if (!sessionAlwaysAllowed.has(sessionId)) {
          sessionAlwaysAllowed.set(sessionId, new Set())
        }
        sessionAlwaysAllowed.get(sessionId)!.add(toolName)
        resolve('allow')
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * 构建工具结果消息
 * Anthropic 使用 user 角色包含 tool_result 块；OpenAI 使用独立的 tool 角色消息
 */
function buildToolResultMessages(
  provider: string,
  results: { id: string; output: string; isError: boolean }[]
): ChatMessage[] {
  if (provider === 'anthropic') {
    return [
      {
        id: `${Date.now()}-tool-results`,
        role: 'user',
        content: results.map(
          (r): Anthropic.ToolResultBlockParam => ({
            type: 'tool_result',
            tool_use_id: r.id,
            content: r.output,
            is_error: r.isError
          })
        ) as unknown as string,
        timestamp: Date.now(),
        _anthropicToolResults: results
      } as ChatMessage
    ]
  }

  // OpenAI / 智谱 AI：每个工具结果对应一条 tool 角色消息
  return results.map((r) => ({
    id: `${Date.now()}-tool-result-${r.id}`,
    role: 'tool' as const,
    content: r.output,
    timestamp: Date.now(),
    _toolCallId: r.id,
    _toolIsError: r.isError
  })) as ChatMessage[]
}

/**
 * 根据提供商路由到对应的流式调用实现
 */
async function streamWithTools(opts: {
  sender: Electron.WebContents
  sessionId: string
  messages: ChatMessage[]
  provider: string
  model: string
  systemPrompt?: string
  maxTokens: number
  signal: AbortSignal
  allTools: MCPTool[]
  toolRouter: ToolRouter
}): Promise<StreamResult> {
  const { provider } = opts

  // 合并本地工具和 MCP 工具
  const mergedTools = opts.toolRouter.mergeTools(opts.allTools)

  if (provider === 'anthropic') {
    return streamAnthropicWithTools(opts, mergedTools)
  }

  // 从注册表查找提供商定义，所有 OpenAI 兼容提供商统一处理
  const providerDef = PROVIDER_MAP.get(provider as AIProvider)
  if (!providerDef) {
    throw new Error(`未知的 AI 提供商: ${provider}`)
  }

  return streamOpenAICompatibleProvider(opts, mergedTools, providerDef)
}

// ── Anthropic ─────────────────────────────────────────────────

/**
 * 构建 Anthropic 消息内容
 * 支持纯文本和多模态（图片 + 文件附件）
 */
function buildAnthropicContent(
  text: string,
  attachments?: Attachment[]
): Anthropic.MessageParam['content'] {
  if (!attachments || attachments.length === 0) {
    return text
  }

  const parts: Anthropic.ContentBlockParam[] = []

  for (const att of attachments) {
    if (att.type === 'image') {
      const mediaType = att.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      parts.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: att.data }
      })
    } else if (att.type === 'file') {
      parts.push({
        type: 'text',
        text: `[文件: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\``
      })
    }
  }

  if (text) {
    parts.push({ type: 'text', text })
  }

  return parts
}

/**
 * 将 ChatMessage[] 转换为 Anthropic MessageParam[]
 * 处理工具调用、工具结果和多模态内容
 */
function buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []

  for (const m of messages) {
    if (m.role === 'system') continue

    if (m.role === 'user') {
      const anthropicMsg = m as ChatMessage & { _anthropicToolResults?: unknown }
      if (anthropicMsg._anthropicToolResults) {
        // 工具结果消息：转换为 tool_result 块
        const toolResults = anthropicMsg._anthropicToolResults as {
          id: string
          output: string
          isError: boolean
        }[]
        result.push({
          role: 'user',
          content: toolResults.map(
            (r): Anthropic.ToolResultBlockParam => ({
              type: 'tool_result',
              tool_use_id: r.id,
              content: r.output,
              is_error: r.isError
            })
          )
        })
        continue
      }
      result.push({
        role: 'user',
        content: buildAnthropicContent(m.content, m.attachments)
      })
      continue
    }

    if (m.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = []
      if (m.content) {
        content.push({ type: 'text', text: m.content })
      }
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input as Record<string, unknown>
          })
        }
      }
      result.push({
        role: 'assistant',
        content: content.length === 1 && content[0].type === 'text' ? m.content : content
      })
      continue
    }
  }

  return result
}

/** Anthropic 流式调用实现，支持工具调用解析 */
async function streamAnthropicWithTools(
  opts: {
    sender: Electron.WebContents
    sessionId: string
    messages: ChatMessage[]
    model: string
    systemPrompt?: string
    maxTokens: number
    signal: AbortSignal
  },
  tools: MCPTool[]
): Promise<StreamResult> {
  const { sender, sessionId, messages, model, systemPrompt, maxTokens, signal } = opts
  const providers = store.get('providers') ?? {}
  const config = providers['anthropic']
  if (!config?.apiKey) throw new Error('Anthropic API Key 未配置')

  const client = new Anthropic({ apiKey: config.apiKey })
  const anthropicMessages = buildAnthropicMessages(messages)

  const streamParams: Anthropic.MessageStreamParams = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: anthropicMessages
  }

  if (tools.length > 0) {
    streamParams.tools = toAnthropicTools(tools)
  }

  let fullContent = ''
  const toolCalls: ParsedToolCall[] = []
  let currentToolCall: { id: string; name: string; inputJson: string } | null = null

  const stream = client.messages.stream(streamParams)
  signal.addEventListener('abort', () => stream.controller.abort())

  for await (const event of stream) {
    if (signal.aborted) break

    if (event.type === 'content_block_start') {
      const block = event.content_block as Anthropic.ContentBlock
      if (block.type === 'tool_use') {
        // 开始接收工具调用
        currentToolCall = { id: block.id, name: block.name, inputJson: '' }
      }
    }

    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        const text = event.delta.text
        fullContent += text
        const chunk: AIStreamChunk = { type: 'text_delta', sessionId, content: text }
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk)
      }
      if (event.delta.type === 'input_json_delta' && currentToolCall) {
        // 累积工具调用的 JSON 参数
        currentToolCall.inputJson += event.delta.partial_json
      }
    }

    if (event.type === 'content_block_stop' && currentToolCall) {
      // 工具调用参数接收完毕，解析 JSON
      try {
        const input = JSON.parse(currentToolCall.inputJson || '{}')
        toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, input })
      } catch {
        toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, input: {} })
      }
      currentToolCall = null
    }
  }

  return { fullContent, toolCalls }
}

// ── OpenAI / 智谱 AI ──────────────────────────────────────────

/**
 * 构建 OpenAI 消息内容
 * 支持纯文本和多模态（图片 URL + 文件文本）
 */
function buildOpenAIContent(
  text: string,
  attachments?: Attachment[]
): OpenAI.Chat.ChatCompletionContentPart[] | string {
  if (!attachments || attachments.length === 0) {
    return text
  }

  const parts: OpenAI.Chat.ChatCompletionContentPart[] = []

  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${att.mimeType};base64,${att.data}` }
      })
    } else if (att.type === 'file') {
      parts.push({
        type: 'text',
        text: `[文件: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\``
      })
    }
  }

  if (text) {
    parts.push({ type: 'text', text })
  }

  return parts
}

/**
 * 将 ChatMessage[] 转换为 OpenAI ChatCompletionMessageParam[]
 * 处理工具调用和工具结果消息
 */
function buildOpenAIMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = []

  for (const m of messages) {
    if (m.role === 'system') {
      result.push({ role: 'system', content: m.content })
      continue
    }

    if (m.role === 'user') {
      result.push({ role: 'user', content: buildOpenAIContent(m.content, m.attachments) })
      continue
    }

    if (m.role === 'assistant') {
      const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: m.content || null
      }
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input)
          }
        }))
      }
      result.push(msg)
      continue
    }

    if (m.role === 'tool') {
      const toolMsg = m as ChatMessage & { _toolCallId?: string; _toolIsError?: boolean }
      result.push({
        role: 'tool',
        content: m.content,
        tool_call_id: toolMsg._toolCallId ?? ''
      })
      continue
    }
  }

  return result
}

/**
 * 通用的 OpenAI 兼容提供商流式调用
 * 从提供商注册表获取配置（baseUrl、apiKey），适用于所有 OpenAI 兼容接口
 */
async function streamOpenAICompatibleProvider(
  opts: {
    sender: Electron.WebContents
    sessionId: string
    messages: ChatMessage[]
    provider: string
    model: string
    systemPrompt?: string
    maxTokens: number
    signal: AbortSignal
  },
  tools: MCPTool[],
  providerDef: { id: string; name: string; defaultBaseUrl?: string }
): Promise<StreamResult> {
  const { sender, sessionId, messages, model, systemPrompt, maxTokens, signal } = opts
  const providers = store.get('providers') ?? {}
  const config = providers[opts.provider]
  if (!config?.apiKey && providerDef.defaultBaseUrl !== 'http://localhost:11434/v1') {
    throw new Error(`${providerDef.name} API Key 未配置`)
  }

  const baseURL = config?.baseUrl || providerDef.defaultBaseUrl
  if (!baseURL) {
    throw new Error(`${providerDef.name} Base URL 未配置`)
  }

  const client = new OpenAI({
    apiKey: config?.apiKey || 'unused',
    baseURL
  })

  const openaiMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...buildOpenAIMessages(messages)]
    : buildOpenAIMessages(messages)

  const createParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    model,
    messages: openaiMessages,
    max_tokens: maxTokens,
    stream: true
  }

  if (tools.length > 0) {
    createParams.tools = toOpenAITools(tools)
  }

  return streamOpenAICompatible(client, createParams, sender, sessionId, signal)
}

/**
 * OpenAI 兼容接口的通用流式调用实现
 * 同时处理文本增量和工具调用参数的流式拼接
 */
async function streamOpenAICompatible(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsStreaming,
  sender: Electron.WebContents,
  sessionId: string,
  signal: AbortSignal
): Promise<StreamResult> {
  let fullContent = ''
  // 使用 index 作为 key，因为流式工具调用按 index 分片
  const toolCallsMap = new Map<number, { id: string; name: string; argsJson: string }>()

  const stream = await client.chat.completions.create(params, { signal })

  for await (const chunk of stream) {
    if (signal.aborted) break

    const delta = chunk.choices[0]?.delta
    if (!delta) continue

    if (delta.content) {
      fullContent += delta.content
      const streamChunk: AIStreamChunk = { type: 'text_delta', sessionId, content: delta.content }
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, streamChunk)
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        if (!toolCallsMap.has(idx)) {
          toolCallsMap.set(idx, {
            id: tc.id ?? `tc_${idx}`,
            name: tc.function?.name ?? '',
            argsJson: ''
          })
        }
        const entry = toolCallsMap.get(idx)!
        if (tc.id) entry.id = tc.id
        if (tc.function?.name) entry.name = tc.function.name
        if (tc.function?.arguments) entry.argsJson += tc.function.arguments
      }
    }
  }

  // 将累积的工具调用参数解析为 JSON
  const toolCalls: ParsedToolCall[] = []
  for (const [, entry] of toolCallsMap) {
    try {
      const input = JSON.parse(entry.argsJson || '{}')
      toolCalls.push({ id: entry.id, name: entry.name, input })
    } catch {
      toolCalls.push({ id: entry.id, name: entry.name, input: {} })
    }
  }

  return { fullContent, toolCalls }
}

/** 根据提供商和模型名称查找上下文窗口大小，默认 128K */
function getContextWindow(provider: string, model: string): number {
  const models = PROVIDER_MODELS[provider]
  if (models) {
    const found = models.find((m) => m.id === model)
    if (found) return found.contextWindow
  }
  return 128000
}

/** 格式化 token 数为可读字符串（K/M 单位） */
function fmtTk(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
