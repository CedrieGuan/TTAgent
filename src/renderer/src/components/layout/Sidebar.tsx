import React from 'react'
import { useSessionStore } from '@stores/session.store'
import { Button } from '@components/ui/Button'
import { truncate, formatTime } from '@lib/utils'

type Page = 'chat' | 'history' | 'settings' | 'agent-config'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { sessions, currentSessionId, selectSession, createSession, deleteSession } =
    useSessionStore()

  const handleNewChat = async () => {
    await createSession()
    onNavigate('chat')
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      {/* 新建对话按钮 */}
      <div className="p-3">
        <Button variant="primary" size="md" className="w-full" onClick={handleNewChat}>
          <PlusIcon />
          新建对话
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-[var(--color-text-muted)]">
            暂无对话，点击上方创建
          </p>
        )}
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`no-drag group mb-0.5 flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors duration-100 overflow-hidden
              ${currentSessionId === session.id && currentPage === 'chat'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            onClick={() => {
              selectSession(session.id)
              onNavigate('chat')
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {truncate(session.title, 24)}
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
            </div>
            {session.lastMessage && (
              <span className="w-full truncate text-xs text-[var(--color-text-muted)]">
                {truncate(session.lastMessage, 36)}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatTime(session.updatedAt)}
            </span>
          </button>
        ))}
      </div>

      {/* 底部导航 */}
      <nav className="border-t border-[var(--color-border-subtle)] p-2 space-y-0.5">
        <NavItem
          icon={<AgentIcon />}
          label="Agent 配置"
          active={currentPage === 'agent-config'}
          onClick={() => onNavigate('agent-config')}
        />
        <NavItem
          icon={<SettingsIcon />}
          label="设置"
          active={currentPage === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </nav>
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`no-drag flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors duration-100
        ${active
          ? 'bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
        }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
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

const SettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const AgentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)
