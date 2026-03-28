import React, { useState } from 'react'
import { useSessionStore } from '@stores/session.store'
import { ChatPage } from '@pages/ChatPage'
import { truncate, formatTime } from '@lib/utils'

interface ChatPanelProps {
  open: boolean
  onToggle: () => void
}

export function ChatPanel({ open, onToggle }: ChatPanelProps) {
  const { sessions, currentSessionId, selectSession, createSession, deleteSession } =
    useSessionStore()
  const [sessionListCollapsed, setSessionListCollapsed] = useState(false)

  const handleNewChat = async () => {
    await createSession()
  }

  const handleSelectSession = (id: string) => {
    selectSession(id)
  }

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="no-drag flex w-10 shrink-0 flex-col items-center justify-center border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] transition-all duration-200 ease-in-out hover:bg-[var(--color-bg-hover)]"
      >
        <span className="write-vertical-right text-xs text-[var(--color-text-muted)] [writing-mode:vertical-rl] tracking-widest">
          AI 对话
        </span>
      </button>
    )
  }

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] transition-all duration-200 ease-in-out">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">AI 对话</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="新建会话"
          >
            <PlusIcon />
          </button>
          <button
            onClick={onToggle}
            className="no-drag flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="收起面板"
          >
            <PanelCloseIcon />
          </button>
        </div>
      </div>

      <button
        onClick={() => setSessionListCollapsed((v) => !v)}
        className="no-drag flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <svg
          className="h-3 w-3 transition-transform duration-200"
          style={{ transform: sessionListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
        会话列表
        <span className="text-[var(--color-text-muted)]">({sessions.length})</span>
      </button>

      {!sessionListCollapsed && (
        <div className="max-h-[200px] overflow-y-auto overflow-x-hidden px-2">
          {sessions.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">
              暂无对话，点击 + 创建
            </p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`no-drag group mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-100 overflow-hidden
                ${
                  currentSessionId === session.id
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              onClick={() => handleSelectSession(session.id)}
            >
              <span className="min-w-0 truncate text-xs font-medium flex-1">
                {truncate(session.title, 20)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                {formatTime(session.updatedAt)}
              </span>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 hover:text-[var(--color-error)] transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(session.id)
                }}
                title="删除会话"
              >
                <TrashIcon />
              </button>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden border-t border-[var(--color-border-subtle)]">
        <ChatPage />
      </div>
    </aside>
  )
}

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
)

const PanelCloseIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M15 3v18" />
    <path d="M10 9l-3 3 3 3" />
  </svg>
)
