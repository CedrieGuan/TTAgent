import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { ChatMessage } from '@shared/types/ai.types'
import { store } from '../store'
import { manageContext } from '../lib/context-strategy'
import { emitContextEvent, createEvent } from '../lib/context-events'
import { calculateBudget } from '../lib/token-counter'
import { PROVIDER_MODELS } from '@shared/constants/providers'

interface CompressPayload {
  sessionId: string
  provider: string
  model: string
  systemPrompt?: string
  mcpToolsCount?: number
}

export function registerContextHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.CONTEXT_COMPRESS,
    async (event, payload: CompressPayload): Promise<IPCResponse> => {
      const { sessionId, provider, model, mcpToolsCount = 0 } = payload
      const sender = event.sender

      try {
        const messages: ChatMessage[] = store.get(`messages.${sessionId}` as never) ?? []
        if (messages.length === 0) {
          return { success: true, data: { message: '没有消息需要压缩' } }
        }

        const contextWindow = getContextWindow(provider, model)
        const maxTokens = 4096

        const ctxResult = manageContext({
          sessionId,
          messages,
          contextWindow,
          maxTokens,
          tools: []
        })

        for (const evt of ctxResult.events) {
          emitContextEvent(sender, evt)
        }

        const budget = calculateBudget(contextWindow, maxTokens, mcpToolsCount > 0)
        const totalTokens = ctxResult.totalTokens
        const usagePercent = Math.round((totalTokens / budget.usableInputBudget) * 100)

        emitContextEvent(
          sender,
          createEvent(
            'context_budget_info',
            sessionId,
            `上下文使用 ${usagePercent}%（${formatTokenCount(totalTokens)} / ${formatTokenCount(budget.usableInputBudget)}）`,
            {
              totalTokens,
              budgetTokens: budget.usableInputBudget,
              usagePercent
            }
          )
        )

        if (ctxResult.wasManaged) {
          store.set(`messages.${sessionId}` as never, ctxResult.messages as never)
          emitContextEvent(
            sender,
            createEvent('context_truncated', sessionId, '手动压缩完成', {
              messagesAffected: messages.length - ctxResult.messages.length
            })
          )
        }

        return { success: true, data: { wasManaged: ctxResult.wasManaged } }
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err)
        return { success: false, error }
      }
    }
  )
}

function getContextWindow(provider: string, model: string): number {
  const models = PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]
  if (models) {
    const found = models.find((m) => m.id === model)
    if (found) return found.contextWindow
  }
  return 128000
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
