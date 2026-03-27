import { ipcMain } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { ZHIPUAI_BASE_URL } from '@shared/constants/providers'
import { persistMessage } from './session.handler'
import type { AIRequestPayload, AIStreamChunk, IPCResponse } from '@shared/types/ipc.types'
import type { ChatMessage, Attachment } from '@shared/types/ai.types'

// 存储活跃流的 AbortController，用于取消
const activeStreams = new Map<string, AbortController>()

export function registerAIHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.AI_SEND_MESSAGE,
    async (event, payload: AIRequestPayload): Promise<IPCResponse> => {
      const { sessionId, messages, provider, model, systemPrompt, maxTokens = 4096 } = payload
      const sender = event.sender

      const abortController = new AbortController()
      activeStreams.set(sessionId, abortController)

      // 先持久化用户消息（最后一条）
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'user') {
        persistMessage(sessionId, lastMessage)
      }

      try {
        let fullContent = ''

        if (provider === 'anthropic') {
          fullContent = await streamAnthropic({
            sender,
            sessionId,
            messages,
            model,
            systemPrompt,
            maxTokens,
            signal: abortController.signal
          })
        } else if (provider === 'openai') {
          fullContent = await streamOpenAI({
            sender,
            sessionId,
            messages,
            model,
            systemPrompt,
            maxTokens,
            signal: abortController.signal
          })
        } else if (provider === 'zhipuai') {
          fullContent = await streamZhipuAI({
            sender,
            sessionId,
            messages,
            model,
            systemPrompt,
            maxTokens,
            signal: abortController.signal
          })
        } else {
          throw new Error(`Provider "${provider}" not yet supported`)
        }

        // 持久化 assistant 回复
        if (fullContent) {
          const assistantMsg: ChatMessage = {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now()
          }
          persistMessage(sessionId, assistantMsg)
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

// 将附件转换为 Anthropic 图片内容块
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
      // 文件作为文本注入到消息中
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

// 将附件转换为 OpenAI 内容部分
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

async function streamAnthropic(opts: {
  sender: Electron.WebContents
  sessionId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
  maxTokens: number
  signal: AbortSignal
}): Promise<string> {
  const { sender, sessionId, messages, model, systemPrompt, maxTokens, signal } = opts
  const providers = store.get('providers') ?? {}
  const config = providers['anthropic']
  if (!config?.apiKey) throw new Error('Anthropic API Key 未配置')

  const client = new Anthropic({ apiKey: config.apiKey })

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: buildAnthropicContent(m.content, m.attachments)
    }))

  let fullContent = ''

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: anthropicMessages
  })

  signal.addEventListener('abort', () => stream.controller.abort())

  for await (const event of stream) {
    if (signal.aborted) break

    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const text = event.delta.text
      fullContent += text
      const chunk: AIStreamChunk = { type: 'text_delta', sessionId, content: text }
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk)
    }
  }

  return fullContent
}

async function streamOpenAI(opts: {
  sender: Electron.WebContents
  sessionId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
  maxTokens: number
  signal: AbortSignal
}): Promise<string> {
  const { sender, sessionId, messages, model, systemPrompt, maxTokens, signal } = opts
  const providers = store.get('providers') ?? {}
  const config = providers['openai']
  if (!config?.apiKey) throw new Error('OpenAI API Key 未配置')

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
  })

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages
      .filter((m) => m.role !== 'system')
      .map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === 'user') {
          return { role: 'user', content: buildOpenAIContent(m.content, m.attachments) }
        }
        return { role: 'assistant', content: m.content }
      })
  ]

  let fullContent = ''

  const stream = await client.chat.completions.create(
    { model, messages: openaiMessages, max_tokens: maxTokens, stream: true },
    { signal }
  )

  for await (const chunk of stream) {
    if (signal.aborted) break
    const text = chunk.choices[0]?.delta?.content ?? ''
    if (text) {
      fullContent += text
      const streamChunk: AIStreamChunk = { type: 'text_delta', sessionId, content: text }
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, streamChunk)
    }
  }

  return fullContent
}

async function streamZhipuAI(opts: {
  sender: Electron.WebContents
  sessionId: string
  messages: ChatMessage[]
  model: string
  systemPrompt?: string
  maxTokens: number
  signal: AbortSignal
}): Promise<string> {
  const { sender, sessionId, messages, model, systemPrompt, maxTokens, signal } = opts
  const providers = store.get('providers') ?? {}
  const config = providers['zhipuai']
  if (!config?.apiKey) throw new Error('智谱 AI API Key 未配置')

  // 智谱 AI 提供 OpenAI 兼容接口，直接复用 OpenAI SDK
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: ZHIPUAI_BASE_URL
  })

  const zhipuMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages
      .filter((m) => m.role !== 'system')
      .map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === 'user') {
          return { role: 'user', content: buildOpenAIContent(m.content, m.attachments) }
        }
        return { role: 'assistant', content: m.content }
      })
  ]

  let fullContent = ''

  const stream = await client.chat.completions.create(
    { model, messages: zhipuMessages, max_tokens: maxTokens, stream: true },
    { signal }
  )

  for await (const chunk of stream) {
    if (signal.aborted) break
    const text = chunk.choices[0]?.delta?.content ?? ''
    if (text) {
      fullContent += text
      const streamChunk: AIStreamChunk = { type: 'text_delta', sessionId, content: text }
      if (!sender.isDestroyed()) sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, streamChunk)
    }
  }

  return fullContent
}
