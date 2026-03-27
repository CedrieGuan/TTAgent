import React from 'react'

interface TitlebarProps {
  title?: string
}

const isMac = navigator.userAgent.includes('Mac')

export function Titlebar({ title = 'TTAgent' }: TitlebarProps) {
  return (
    <div
      className="drag-region flex h-11 shrink-0 items-center border-b border-[var(--color-border-subtle)]"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* macOS 交通灯按钮占位（系统自己渲染，留出空间） */}
      {isMac && <div className="w-20 shrink-0" />}

      {/* 标题居中 */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs font-medium text-[var(--color-text-muted)] select-none">
          {title}
        </span>
      </div>

      {/* Windows / Linux 自定义窗口控制 */}
      {!isMac && (
        <div className="no-drag flex items-center shrink-0">
          <WindowButton
            onClick={() => window.api.minimizeWindow()}
            title="最小化"
            icon={<MinimizeIcon />}
          />
          <WindowButton
            onClick={() => window.api.maximizeWindow()}
            title="最大化"
            icon={<MaximizeIcon />}
          />
          <WindowButton
            onClick={() => window.api.closeWindow()}
            title="关闭"
            icon={<CloseIcon />}
            danger
          />
        </div>
      )}
    </div>
  )
}

function WindowButton({
  onClick,
  title,
  icon,
  danger
}: {
  onClick: () => void
  title: string
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-11 w-12 flex items-center justify-center transition-colors duration-100
        ${danger ? 'hover:bg-red-600' : 'hover:bg-[var(--color-bg-hover)]'}
        text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`}
    >
      {icon}
    </button>
  )
}

const MinimizeIcon = () => (
  <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
    <rect width="10" height="1" />
  </svg>
)

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="0.5" y="0.5" width="9" height="9" />
  </svg>
)

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
    <line x1="0" y1="0" x2="10" y2="10" />
    <line x1="10" y1="0" x2="0" y2="10" />
  </svg>
)
