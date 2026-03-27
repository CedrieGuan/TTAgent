import React from 'react'
import { useSessionStore } from '@stores/session.store'
import { Button } from '@components/ui/Button'
import { formatTime } from '@lib/utils'

interface HistoryPageProps {
  onNavigateToChat: () => void
}

export function HistoryPage({ onNavigateToChat }: HistoryPageProps) {
  const { sessions, selectSession, deleteSession } = useSessionStore()

  const handleOpen = (id: string) => {
    selectSession(id)
    onNavigateToChat()
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="max-w-2xl w-full mx-auto p-8 space-y-6 min-w-0 overflow-hidden">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">历史记录</h1>

        {sessions.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">暂无历史对话</p>
        )}

        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="group flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3 hover:border-[var(--color-accent)]/40 transition-colors cursor-pointer overflow-hidden"
              onClick={() => handleOpen(session.id)}
            >
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {session.title}
                </p>
                {session.lastMessage && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    {session.lastMessage}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {session.messageCount} 条消息 · {formatTime(session.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
