import React from 'react'

export function TasksPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="1" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">任务功能即将上线</p>
        <p className="text-xs text-[var(--color-text-muted)]">正在开发中，敬请期待</p>
      </div>
    </div>
  )
}
