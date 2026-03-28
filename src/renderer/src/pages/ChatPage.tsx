import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageList } from '@components/chat/MessageList'
import { InputArea } from '@components/chat/InputArea'
import { useChat } from '@hooks/useChat'
import { useChatStore } from '@stores/chat.store'
import { pushLog } from '@stores/log.store'
import { useSessionStore } from '@stores/session.store'
import { useAgentStore } from '@stores/agent.store'
import { useMemoryStore } from '@stores/memory.store'
import { PROVIDER_MODELS, PROVIDER_LABELS } from '@shared/constants/providers'
import type { AIProvider } from '@shared/types/ai.types'

export function ChatPage() {
  const {
    messages,
    isThinking,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    sendMessage,
    cancelStream
  } = useChat()
  const { loadMessages, contextEventsBySession, pendingConfirmsBySession, removePendingConfirm } =
    useChatStore()
  const { currentSessionId, getCurrentSession, updateModel } = useSessionStore()
  const { allTools, toolsEnabled } = useAgentStore()
  const { memoryEventsBySession, loadMemories, loaded: memoryLoaded } = useMemoryStore()
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId)
    }
  }, [currentSessionId, loadMessages])

  useEffect(() => {
    if (!memoryLoaded) {
      loadMemories().catch((err) => pushLog('error', 'memory', String(err)))
    }
  }, [memoryLoaded, loadMemories])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false)
      }
    }
    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [modelDropdownOpen])

  const session = getCurrentSession()

  const budgetEvent = useMemo(() => {
    const events = currentSessionId ? contextEventsBySession[currentSessionId] : undefined
    if (!events) return null
    const budgetEvents = events.filter((e) => e.type === 'context_budget_info')
    return budgetEvents.length > 0 ? budgetEvents[budgetEvents.length - 1] : null
  }, [currentSessionId, contextEventsBySession])

  const handleModelSelect = async (provider: AIProvider, modelId: string) => {
    if (!currentSessionId) return
    await updateModel(currentSessionId, provider, modelId)
    setModelDropdownOpen(false)
  }

  const handleConfirmRespond = useCallback(
    (confirmId: string, response: 'allow' | 'reject' | 'always_allow') => {
      if (!currentSessionId) return
      removePendingConfirm(currentSessionId, confirmId)
      window.api.sendToolConfirmResponse({ confirmId, response })
    },
    [currentSessionId, removePendingConfirm]
  )

  const handleCompress = async () => {
    if (!currentSessionId || !session || compressing || isStreaming || isThinking) return
    setCompressing(true)
    try {
      await window.api.compressContext({
        sessionId: currentSessionId,
        provider: session.provider,
        model: session.model,
        mcpToolsCount: toolsEnabled ? allTools.length : 0
      })
      await loadMessages(currentSessionId)
    } finally {
      setCompressing(false)
    }
  }

  if (!currentSessionId) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-text-muted)] text-sm">
        请在上方创建或选择一个对话
      </div>
    )
  }

  const currentModelName = session
    ? (PROVIDER_MODELS[session.provider]?.find((m) => m.id === session.model)?.name ??
      session.model)
    : ''

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-6 py-2.5">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {session?.title ?? '对话'}
        </span>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)] transition-colors border border-transparent hover:border-[var(--color-border)]"
          >
            <span>{currentModelName}</span>
            <ChevronDownIcon />
          </button>

          {modelDropdownOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden">
              {(Object.keys(PROVIDER_MODELS) as AIProvider[])
                .filter((p) => PROVIDER_MODELS[p].length > 0)
                .map((provider) => (
                  <div key={provider}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-base)]">
                      {PROVIDER_LABELS[provider]}
                    </div>
                    {PROVIDER_MODELS[provider].map((model) => {
                      const isActive = session?.provider === provider && session?.model === model.id
                      return (
                        <button
                          key={model.id}
                          onClick={() => handleModelSelect(provider, model.id)}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors
                            ${
                              isActive
                                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)]'
                            }`}
                        >
                          <span>{model.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {model.supportsVision && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)]">
                                视觉
                              </span>
                            )}
                            {isActive && <CheckIcon />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {budgetEvent && (
          <span
            className={`text-[10px] font-mono ${
              (budgetEvent.data?.usagePercent ?? 0) > 75
                ? 'text-amber-400'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {budgetEvent.data?.usagePercent ?? '?'}%
          </span>
        )}

        <button
          onClick={handleCompress}
          disabled={compressing || isStreaming || isThinking || messages.length === 0}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)] transition-colors border border-transparent hover:border-[var(--color-border)] disabled:opacity-40 disabled:pointer-events-none"
          title="压缩上下文"
        >
          <CompressIcon spinning={compressing} />
          <span>{compressing ? '压缩中...' : '压缩'}</span>
        </button>
      </div>

      <MessageList
        messages={messages}
        isThinking={isThinking}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingToolCalls={streamingToolCalls}
        contextEvents={currentSessionId ? (contextEventsBySession[currentSessionId] ?? []) : []}
        memoryEvents={currentSessionId ? (memoryEventsBySession[currentSessionId] ?? []) : []}
        sessionId={currentSessionId}
        pendingConfirms={currentSessionId ? (pendingConfirmsBySession[currentSessionId] ?? []) : []}
        onConfirmRespond={handleConfirmRespond}
      />

      <InputArea
        onSend={sendMessage}
        onCancel={cancelStream}
        isStreaming={isStreaming}
        isThinking={isThinking}
      />
    </div>
  )
}

const ChevronDownIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function CompressIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <polyline points="12 12 12 21" />
      <polyline points="8 17 12 21 16 17" />
    </svg>
  )
}
