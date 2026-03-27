import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { ZHIPUAI_BASE_URL } from '@shared/constants/providers'
import { persistMessage } from './session.handler'
import { mcpClients } from './mcp.handler'
import { ToolRouter } from '../tools/tool-router'
import { toAnthropicTools, toOpenAITools } from '../tools/tool-schema'
import type { AIRequestPayload, AIStreamChunk, IPCResponse } from '@shared/types/ipc.types'
import type { ChatMessage, Attachment } from '@shared/types/ai.types'
import type { MCPTool } from '@shared/types/mcp.types'
import { PROVIDER_MODELS } from '@shared/constants/providers'
import { manageContext, applyMidLoopCheck } from '../lib/context-strategy'
import { emitContextEvent, createEvent } from '../lib/context-events'
import { countMessagesTokens, calculateBudget } from '../lib/token-counter'

const activeStreams = new Map<string, AbortController>()
const MAX_AGENT_ITERATIONS = 15

interface StreamResult {
  fullContent: string
  toolCalls: ParsedToolCall[]
}

interface ParsedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export function registerAIHandlers(): void {
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

      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        persistMessage(sessionId, lastMessage)
      }

      const allTools = mcpTools ?? []
      const toolRouter = new ToolRouter(mcpClients)

      try {
        const contextWindow = getContextWindow(provider, model)

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

        const agentMessages: ChatMessage[] = [...ctxResult.messages]
        let finalContent = ''

        for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
          if (abortController.signal.aborted) break

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

          if (result.toolCalls.length === 0) {
            break
          }

          const toolResults = await executeToolCalls(
            sender,
            sessionId,
            result.toolCalls,
            toolRouter,
            abortController.signal
          )

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

          const agentMsgChunk: AIStreamChunk = {
            type: 'agent_message',
            sessionId,
            agentMessage: assistantMsg
          }
          if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, agentMsgChunk)

          const toolResultMsgs = buildToolResultMessages(provider, toolResults)
          for (const trMsg of toolResultMsgs) {
            agentMessages.push(trMsg)
          }
        }

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
        const stopChunk: AIStreamChunk = { type: 'stop', sessionId }
        if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, stopChunk)
      }
    }
  )

  ipcMain.on(IPC_CHANNELS.AI_CANCEL_STREAM, (_event, sessionId: string) => {
    activeStreams.get(sessionId)?.abort()
    activeStreams.delete(sessionId)
  })
}

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

    const startChunk: AIStreamChunk = {
      type: 'tool_use_start',
      sessionId,
      toolCallId: tc.id,
      toolName: tc.name,
      toolInput: tc.input
    }
    if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, startChunk)

    const result = await toolRouter.executeTool(tc.name, tc.input)

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

  return results.map((r) => ({
    id: `${Date.now()}-tool-result-${r.id}`,
    role: 'tool' as const,
    content: r.output,
    timestamp: Date.now(),
    _toolCallId: r.id,
    _toolIsError: r.isError
  })) as ChatMessage[]
}

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

  const mergedTools = opts.toolRouter.mergeTools(opts.allTools)

  if (provider === 'anthropic') {
    return streamAnthropicWithTools(opts, mergedTools)
  }
  if (provider === 'openai') {
    return streamOpenAIWithTools(opts, mergedTools)
  }
  if (provider === 'zhipuai') {
    return streamZhipuAIWithTools(opts, mergedTools)
  }

  throw new Error(`Provider "${provider}" not yet supported`)
}

// ── Anthropic ─────────────────────────────────────────────

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

function buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = []

  for (const m of messages) {
    if (m.role === 'system') continue

    if (m.role === 'user') {
      const anthropicMsg = m as ChatMessage & { _anthropicToolResults?: unknown }
      if (anthropicMsg._anthropicToolResults) {
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
        currentToolCall = {
          id: block.id,
          name: block.name,
          inputJson: ''
        }
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
        currentToolCall.inputJson += event.delta.partial_json
      }
    }

    if (event.type === 'content_block_stop' && currentToolCall) {
      try {
        const input = JSON.parse(currentToolCall.inputJson || '{}')
        toolCalls.push({
          id: currentToolCall.id,
          name: currentToolCall.name,
          input
        })
      } catch {
        toolCalls.push({
          id: currentToolCall.id,
          name: currentToolCall.name,
          input: {}
        })
      }
      currentToolCall = null
    }
  }

  return { fullContent, toolCalls }
}

// ── OpenAI / 智谱 ────────────────────────────────────────

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

async function streamOpenAIWithTools(
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
  const config = providers['openai']
  if (!config?.apiKey) throw new Error('OpenAI API Key 未配置')

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
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

async function streamZhipuAIWithTools(
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
  const config = providers['zhipuai']
  if (!config?.apiKey) throw new Error('智谱 AI API Key 未配置')

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: ZHIPUAI_BASE_URL
  })

  const zhipuMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...buildOpenAIMessages(messages)]
    : buildOpenAIMessages(messages)

  const createParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    model,
    messages: zhipuMessages,
    max_tokens: maxTokens,
    stream: true
  }

  if (tools.length > 0) {
    createParams.tools = toOpenAITools(tools)
  }

  return streamOpenAICompatible(client, createParams, sender, sessionId, signal)
}

async function streamOpenAICompatible(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsStreaming,
  sender: Electron.WebContents,
  sessionId: string,
  signal: AbortSignal
): Promise<StreamResult> {
  let fullContent = ''
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

  const toolCalls: ParsedToolCall[] = []
  for (const [_, entry] of toolCallsMap) {
    try {
      const input = JSON.parse(entry.argsJson || '{}')
      toolCalls.push({ id: entry.id, name: entry.name, input })
    } catch {
      toolCalls.push({ id: entry.id, name: entry.name, input: {} })
    }
  }

  return { fullContent, toolCalls }
}

function getContextWindow(provider: string, model: string): number {
  const models = PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]
  if (models) {
    const found = models.find((m) => m.id === model)
    if (found) return found.contextWindow
  }
  return 128000
}

function fmtTk(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
