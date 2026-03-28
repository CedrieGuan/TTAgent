import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@lib/utils'
import {
  useLogStore,
  getFilteredEntries,
  getLogCount,
  getTotalCount,
  getAvailableScopes,
  clearAllLogs,
  type LogEntry,
  type LogLevel
} from '@stores/log.store'

/** 日志级别配置：颜色、标签、图标 */
const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; bg: string; dot: string }> = {
  debug: {
    label: 'DBG',
    color: 'text-[var(--color-text-muted)]',
    bg: 'bg-[var(--color-text-muted)]/10',
    dot: 'bg-[var(--color-text-muted)]'
  },
  info: {
    label: 'INF',
    color: 'text-[var(--color-accent)]',
    bg: 'bg-[var(--color-accent)]/10',
    dot: 'bg-[var(--color-accent)]'
  },
  warn: {
    label: 'WRN',
    color: 'text-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning)]/10',
    dot: 'bg-[var(--color-warning)]'
  },
  error: {
    label: 'ERR',
    color: 'text-[var(--color-error)]',
    bg: 'bg-[var(--color-error)]/10',
    dot: 'bg-[var(--color-error)]'
  }
}

/** 轮询间隔（ms） */
const POLL_INTERVAL = 200

export function LogViewer() {
  const {
    filterLevels,
    filterScopes,
    isOpen,
    autoScroll,
    toggleOpen,
    toggleFilterLevel,
    toggleFilterScope,
    setAutoScroll
  } = useLogStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [logCount, setLogCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [scopes, setScopes] = useState<string[]>([])
  const [, setTick] = useState(0)

  /** 轮询最新日志数据 */
  const refresh = useCallback(() => {
    const filtered = getFilteredEntries(filterLevels, filterScopes)
    setEntries(filtered)
    setLogCount(getLogCount())
    setTotalCount(getTotalCount())
    setScopes(getAvailableScopes())
    setTick((t) => t + 1)
  }, [filterLevels, filterScopes])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [refresh])

  /** 自动滚动到底部 */
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, autoScroll])

  const handleClear = useCallback(() => {
    clearAllLogs()
    refresh()
  }, [refresh])

  const filteredCount = entries.length

  return (
    <>
      {/* 底部拖拽条 + 展开按钮 */}
      <div className="relative z-30 no-drag">
        <button
          onClick={toggleOpen}
          className={cn(
            'absolute -top-1 left-1/2 -translate-x-1/2 z-40',
            'flex items-center gap-2 px-3 py-1 rounded-t-lg',
            'text-[10px] font-mono tracking-wider uppercase',
            'transition-all duration-300 cursor-pointer',
            'border border-b-0 border-[var(--color-border-subtle)]',
            isOpen
              ? 'bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] translate-y-0'
              : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] translate-y-0'
          )}
        >
          <svg
            className={cn('w-3 h-3 transition-transform duration-300', isOpen && 'rotate-180')}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 8L6 4L10 8" />
          </svg>
          <span>logs</span>
          <span className="text-[var(--color-text-muted)]">{logCount}</span>
          {logCount !== totalCount && (
            <span className="text-[var(--color-text-muted)] opacity-50">({totalCount})</span>
          )}
        </button>
      </div>

      {/* 主面板 - 底部抽屉动画 */}
      <div
        className={cn(
          'border-t border-[var(--color-border-subtle)]',
          'bg-[var(--color-bg-surface)]',
          'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'overflow-hidden',
          isOpen ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {/* 工具栏 */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border-subtle)]">
          {/* 日志级别过滤 */}
          <div className="flex items-center gap-1">
            {(Object.keys(LEVEL_CONFIG) as LogLevel[]).map((level) => {
              const cfg = LEVEL_CONFIG[level]
              const isActive = filterLevels.includes(level)
              return (
                <button
                  key={level}
                  onClick={() => toggleFilterLevel(level)}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono',
                    'transition-colors duration-150 cursor-pointer border',
                    isActive
                      ? `${cfg.bg} ${cfg.color} border-current/20`
                      : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
                  )}
                >
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full', cfg.dot, !isActive && 'opacity-40')}
                  />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {/* 分隔 */}
          <div className="w-px h-3.5 bg-[var(--color-border)]" />

          {/* 作用域过滤 */}
          <div className="flex items-center gap-1 max-w-[200px] overflow-x-auto">
            {scopes.map((scope) => {
              const isActive = filterScopes.includes(scope)
              return (
                <button
                  key={scope}
                  onClick={() => toggleFilterScope(scope)}
                  className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono',
                    'transition-colors duration-150 cursor-pointer border whitespace-nowrap',
                    isActive
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20'
                      : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
                  )}
                >
                  {scope}
                </button>
              )
            })}
          </div>

          {/* 弹性空间 */}
          <div className="flex-1" />

          {/* 计数 */}
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
            {filteredCount}
            {filteredCount !== logCount && <span className="opacity-50"> / {logCount}</span>}
            {logCount !== totalCount && <span className="opacity-40"> · {totalCount}</span>}
          </span>

          {/* 自动滚动 */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'p-1 rounded transition-colors duration-150 cursor-pointer',
              autoScroll
                ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}
            title={autoScroll ? '自动滚动：开' : '自动滚动：关'}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 3v10M4 9l4 4 4-4" />
            </svg>
          </button>

          {/* 清空 */}
          <button
            onClick={handleClear}
            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors duration-150 cursor-pointer"
            title="清空日志"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 4h8M6 4V3h4v1M5 4v9h6V4" />
            </svg>
          </button>
        </div>

        {/* 日志列表 */}
        <div
          ref={scrollRef}
          className="overflow-y-auto font-mono text-xs leading-5"
          style={{ height: isOpen ? 'calc(420px - 33px)' : 0 }}
        >
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-[11px]">
              {logCount === 0 ? '暂无日志' : '无匹配条目'}
            </div>
          ) : (
            entries.map((entry) => {
              const cfg = LEVEL_CONFIG[entry.level]
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-start gap-2 px-3 py-0 border-b border-[var(--color-border-subtle)]',
                    'hover:bg-[var(--color-bg-hover)]/50 transition-colors duration-100',
                    entry.level === 'error' && 'bg-[var(--color-error)]/5'
                  )}
                >
                  {/* 时间戳 */}
                  <span className="shrink-0 text-[var(--color-text-muted)] opacity-60 tabular-nums select-text">
                    {entry.timestamp}
                  </span>

                  {/* 级别标签 */}
                  <span
                    className={cn(
                      'shrink-0 w-8 text-center text-[10px] font-semibold tabular-nums rounded-sm px-0.5 py-0.5',
                      cfg.color,
                      cfg.bg
                    )}
                  >
                    {cfg.label}
                  </span>

                  {/* 作用域 */}
                  <span className="shrink-0 text-[var(--color-text-muted)] max-w-[100px] truncate select-text">
                    [{entry.scope}]
                  </span>

                  {/* 消息 */}
                  <span className="text-[var(--color-text-primary)] opacity-90 break-all select-text">
                    {entry.message}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
