import React, { useState, useRef, useEffect } from 'react'
import { useTaskStore } from '@stores/task.store'
import { Button } from '@components/ui/Button'
import { cn } from '@lib/utils'
import type { Task, TaskStatus, TaskPeriod, TaskPriority } from '@shared/types/task.types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待办',
  'in-progress': '进行中',
  completed: '已完成',
  cancelled: '已取消'
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string }> = {
  urgent: { label: '紧急', className: 'bg-red-500/15 text-red-500 border-red-500/25' },
  normal: {
    label: '普通',
    className:
      'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/25'
  },
  low: {
    label: '低优',
    className:
      'bg-[var(--color-text-muted)]/15 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/25'
  }
}

const PERIOD_CONFIG: Record<TaskPeriod, { label: string; className: string }> = {
  short: { label: '短期', className: 'bg-sky-500/15 text-sky-400 border-sky-500/25' },
  long: { label: '长期', className: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' }
}

const STATUS_FILTERS: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待办' },
  { value: 'in-progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
]

const PERIOD_FILTERS: { value: 'all' | TaskPeriod; label: string }[] = [
  { value: 'all', label: '全部周期' },
  { value: 'short', label: '短期' },
  { value: 'long', label: '长期' }
]

function Checkbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'no-drag shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center',
        'transition-all duration-200 cursor-pointer',
        checked
          ? 'bg-[var(--color-success)] border-[var(--color-success)]'
          : 'border-[var(--color-text-muted)]/40 hover:border-[var(--color-text-secondary)]'
      )}
    >
      {checked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform duration-200', direction === 'up' && 'rotate-180')}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function StatusDropdown({
  task,
  onUpdate
}: {
  task: Task
  onUpdate: (id: string, updates: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const statusColors: Record<TaskStatus, string> = {
    pending: 'text-[var(--color-text-secondary)]',
    'in-progress': 'text-[var(--color-accent)]',
    completed: 'text-[var(--color-success)]',
    cancelled: 'text-[var(--color-text-muted)]'
  }

  return (
    <div className="relative no-drag" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
          'transition-colors duration-150 cursor-pointer',
          'hover:bg-[var(--color-bg-hover)]',
          statusColors[task.status]
        )}
      >
        {STATUS_LABELS[task.status]}
        <ChevronIcon direction={open ? 'up' : 'down'} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[100px] py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] shadow-lg">
          {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(([status, label]) => (
            <button
              key={status}
              onClick={() => {
                onUpdate(task.id, { status })
                setOpen(false)
              }}
              className={cn(
                'no-drag w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer',
                status === task.status
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ percent }: { percent: number }) {
  const isComplete = percent === 100
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="h-1.5 flex-1 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isComplete ? 'bg-[var(--color-success)]' : 'bg-[var(--color-accent)]'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums shrink-0">
        {percent}%
      </span>
    </div>
  )
}

function SubTaskSection({ task }: { task: Task }) {
  const { toggleSubtask, addSubtask } = useTaskStore()
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const title = newSubtaskTitle.trim()
    if (!title) return
    addSubtask(task.id, title)
    setNewSubtaskTitle('')
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-1.5 mt-3 ml-8">
      {task.subtasks.map((sub) => (
        <div key={sub.id} className="flex items-center gap-2.5 group py-0.5">
          <Checkbox checked={sub.completed} onClick={() => toggleSubtask(task.id, sub.id)} />
          <span
            className={cn(
              'text-sm flex-1 min-w-0 transition-all duration-200',
              sub.completed
                ? 'text-[var(--color-text-muted)] line-through'
                : 'text-[var(--color-text-primary)]'
            )}
          >
            {sub.title}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef}
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="+ 添加子任务"
          className={cn(
            'no-drag flex-1 h-7 rounded-md border border-transparent px-2 text-sm',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'bg-transparent outline-none transition-colors duration-150',
            'hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:bg-[var(--color-bg-surface-2)]'
          )}
        />
        {newSubtaskTitle.trim() && (
          <button
            onClick={handleAdd}
            className="no-drag text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer font-medium shrink-0"
          >
            添加
          </button>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const { expandedTasks, toggleExpanded, toggleTaskStatus, deleteTask, updateTask } = useTaskStore()
  const isExpanded = expandedTasks.has(task.id)
  const isCompleted = task.status === 'completed'
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length
  const hasSubtasks = task.subtasks.length > 0

  const priority = PRIORITY_CONFIG[task.priority]
  const period = PERIOD_CONFIG[task.period]

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)]',
        'transition-all duration-200 hover:border-[var(--color-border)] hover:shadow-sm',
        isCompleted && 'opacity-60'
      )}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Checkbox checked={isCompleted} onClick={() => toggleTaskStatus(task.id)} />

          <span
            className={cn(
              'text-sm font-medium flex-1 min-w-0 truncate transition-all duration-200',
              isCompleted
                ? 'text-[var(--color-text-muted)] line-through'
                : 'text-[var(--color-text-primary)]'
            )}
          >
            {task.title}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                priority.className
              )}
            >
              {priority.label}
            </span>
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                period.className
              )}
            >
              {period.label}
            </span>
          </div>

          <StatusDropdown task={task} onUpdate={updateTask} />

          <button
            onClick={() => deleteTask(task.id)}
            className="no-drag shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
            title="删除任务"
          >
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
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>

        {task.description && (
          <p
            className={cn(
              'text-xs leading-relaxed ml-[30px] text-[var(--color-text-secondary)]',
              isCompleted && 'line-through'
            )}
          >
            {task.description}
          </p>
        )}

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-[30px]">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 ml-[30px]">
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] shrink-0">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {new Date(task.dueDate).toLocaleDateString('zh-CN')}
            </span>
          )}

          <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
            {new Date(task.createdAt).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>

          {hasSubtasks && (
            <button
              onClick={() => toggleExpanded(task.id)}
              className={cn(
                'no-drag flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded',
                'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
                'hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer shrink-0'
              )}
            >
              <span
                className={
                  completedSubtasks === task.subtasks.length ? 'text-[var(--color-success)]' : ''
                }
              >
                {completedSubtasks}/{task.subtasks.length}
              </span>
              <span className="hidden sm:inline">子任务</span>
              <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
            </button>
          )}

          {(hasSubtasks || task.progress > 0) && <ProgressBar percent={task.progress} />}
        </div>

        {isExpanded && hasSubtasks && <SubTaskSection task={task} />}
      </div>
    </div>
  )
}

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const { createTask } = useTaskStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [period, setPeriod] = useState<TaskPeriod>('short')
  const [tagsInput, setTagsInput] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return

    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)

    await createTask({
      title: trimmed,
      description: description.trim() || undefined,
      priority,
      period,
      tags: tags.length > 0 ? tags : undefined
    })
    onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)]"
    >
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务标题"
        className={cn(
          'no-drag w-full h-9 rounded-md border border-[var(--color-border)] px-3 text-sm',
          'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
          'bg-[var(--color-bg-surface-2)] outline-none transition-colors duration-150',
          'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30'
        )}
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="描述（可选）"
        rows={2}
        className={cn(
          'no-drag w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm resize-none',
          'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
          'bg-[var(--color-bg-surface-2)] outline-none transition-colors duration-150',
          'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30'
        )}
      />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
            优先级
          </span>
          {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG.urgent][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPriority(key)}
                className={cn(
                  'no-drag text-[10px] px-2 py-0.5 rounded border font-medium transition-all duration-150 cursor-pointer',
                  priority === key
                    ? config.className
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
              >
                {config.label}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
            周期
          </span>
          {(Object.entries(PERIOD_CONFIG) as [TaskPeriod, typeof PERIOD_CONFIG.short][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={cn(
                  'no-drag text-[10px] px-2 py-0.5 rounded border font-medium transition-all duration-150 cursor-pointer',
                  period === key
                    ? config.className
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
              >
                {config.label}
              </button>
            )
          )}
        </div>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="标签（逗号分隔）"
          className={cn(
            'no-drag h-7 flex-1 min-w-[120px] rounded-md border border-transparent px-2 text-xs',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'bg-transparent outline-none transition-colors duration-150',
            'hover:border-[var(--color-border)] focus:border-[var(--color-accent)]'
          )}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="primary" size="sm" type="submit" disabled={!title.trim()}>
          创建
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>
          取消
        </Button>
      </div>
    </form>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] py-16 text-center">
      <div className="flex justify-center mb-4">
        <svg
          width="40"
          height="40"
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
      <p className="text-sm text-[var(--color-text-muted)]">暂无任务</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">点击上方「新建任务」开始规划</p>
    </div>
  )
}

export function TasksPage() {
  const {
    statusFilter,
    periodFilter,
    filteredTasks,
    completionStats,
    loadTasks,
    setStatusFilter,
    setPeriodFilter,
    loaded
  } = useTaskStore()

  const [showCreateForm, setShowCreateForm] = useState(false)

  React.useEffect(() => {
    if (!loaded) {
      loadTasks()
    }
  }, [loaded, loadTasks])

  const tasks = filteredTasks()
  const stats = completionStats()

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">任务大厅</h1>
            {stats.total > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-accent)]">{stats.percent}%</span>{' '}
                完成（{stats.completed}/{stats.total}）
              </p>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreateForm(true)}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建任务
          </Button>
        </div>

        {showCreateForm && <CreateTaskForm onClose={() => setShowCreateForm(false)} />}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'no-drag px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer border',
                  statusFilter === f.value
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                    : 'bg-transparent text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PERIOD_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPeriodFilter(f.value)}
                className={cn(
                  'no-drag px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer border',
                  periodFilter === f.value
                    ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                    : 'bg-transparent text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
