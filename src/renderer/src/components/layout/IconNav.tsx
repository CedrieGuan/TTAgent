import React from 'react'

export type NavPage = 'tasks' | 'skills' | 'mcp' | 'memory' | 'history' | 'settings'

interface IconNavProps {
  currentPage: NavPage
  onNavigate: (page: NavPage) => void
}

const NAV_ITEMS: { page: NavPage; icon: React.FC<{ active: boolean }>; label: string }[] = [
  { page: 'tasks', icon: ListChecksIcon, label: '任务' },
  { page: 'skills', icon: ZapIcon, label: 'Skills' },
  { page: 'mcp', icon: PuzzleIcon, label: 'MCP' },
  { page: 'memory', icon: BrainIcon, label: '记忆' },
  { page: 'history', icon: ClockIcon, label: '历史' }
]

export function IconNav({ currentPage, onNavigate }: IconNavProps) {
  return (
    <nav className="flex w-[60px] shrink-0 flex-col items-center border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] py-2">
      {NAV_ITEMS.map(({ page, icon: Icon, label }) => {
        const active = currentPage === page
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`no-drag group relative my-0.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-100
              ${
                active
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            title={label}
          >
            <Icon active={active} />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[var(--color-bg-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[var(--color-border)]">
              {label}
            </span>
          </button>
        )
      })}

      <div className="mt-auto">
        <button
          onClick={() => onNavigate('settings')}
          className={`no-drag group relative my-0.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-100
            ${
              currentPage === 'settings'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          title="设置"
        >
          <SettingsIcon active={currentPage === 'settings'} />
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[var(--color-bg-surface-2)] px-2 py-1 text-xs text-[var(--color-text-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[var(--color-border)]">
            设置
          </span>
        </button>
      </div>
    </nav>
  )
}

function ListChecksIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  )
}

function ZapIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function PuzzleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704l1.568-1.568c.23-.23.338-.556.29-.877-.075-.493-.504-.84-.969-1.02a2.5 2.5 0 1 1 3.237-3.237c.18.464.527.894 1.02.967.322.05.648-.058.878-.288l1.568-1.568a2.402 2.402 0 0 1 1.704-.706c.618 0 1.234.236 1.705.706l1.568 1.568c.23.23.556.338.877.29.493-.075.84-.504 1.02-.969a2.501 2.501 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
    </svg>
  )
}

function BrainIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a6 6 0 0 0-6 6c0 1.66.68 3.16 1.76 4.24L12 16.48l4.24-4.24A5.98 5.98 0 0 0 18 8a6 6 0 0 0-6-6z" />
      <path d="M12 16.48V22" />
      <path d="M8 22h8" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  )
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
