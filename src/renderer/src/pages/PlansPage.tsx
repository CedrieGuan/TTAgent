import React, { useState, useRef, useEffect, useCallback } from 'react'
import { usePlanStore } from '@stores/plan.store'
import { cn } from '@lib/utils'
import type { Plan, PlanGroup } from '@shared/types/plan.types'

export function PlansPage() {
  const {
    plans,
    groups,
    assignments,
    activePlanId,
    editorContent,
    isDirty,
    saving,
    loading,
    loadPlans,
    openPlan,
    updateEditorContent,
    saveCurrentPlan,
    createPlan,
    deletePlan,
    importPlans,
    createGroup,
    updateGroup,
    deleteGroup,
    assignPlanToGroup
  } = usePlanStore()

  const [showNewInput, setShowNewInput] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showGroupInput, setShowGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null)
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const newInputRef = useRef<HTMLInputElement>(null)
  const groupInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus()
  }, [showNewInput])

  useEffect(() => {
    if (showGroupInput) groupInputRef.current?.focus()
  }, [showGroupInput])

  const handleSave = useCallback(() => {
    saveCurrentPlan()
  }, [saveCurrentPlan])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleCreate = async () => {
    const title = newTitle.trim()
    if (!title) return
    await createPlan(title)
    setNewTitle('')
    setShowNewInput(false)
  }

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    await createGroup(name)
    setNewGroupName('')
    setShowGroupInput(false)
  }

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const mdFiles = files
      .filter((f) => f.name.endsWith('.md'))
      .map((f) => (f as File & { path: string }).path)
      .filter(Boolean)
    if (mdFiles.length > 0) {
      await importPlans(mdFiles)
    }
  }

  const handlePlanDragStart = (e: React.DragEvent, planId: string) => {
    setDraggedPlanId(planId)
    e.dataTransfer.setData('text/plain', planId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handlePlanDragEnd = () => {
    setDraggedPlanId(null)
    setDropTargetGroupId(null)
  }

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedPlanId) {
      setDropTargetGroupId(groupId)
    }
  }

  const handleGroupDragLeave = () => {
    setDropTargetGroupId(null)
  }

  const handleGroupDrop = async (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const planId = e.dataTransfer.getData('text/plain') || draggedPlanId
    if (planId && planId !== '') {
      await assignPlanToGroup(planId, groupId)
    }
    setDraggedPlanId(null)
    setDropTargetGroupId(null)
  }

  const handleUngroupedDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedPlanId) {
      setDropTargetGroupId('__ungrouped__')
    }
  }

  const handleUngroupedDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const planId = e.dataTransfer.getData('text/plain') || draggedPlanId
    if (planId && planId !== '') {
      await assignPlanToGroup(planId, null)
    }
    setDraggedPlanId(null)
    setDropTargetGroupId(null)
  }

  const handleRenameGroup = async (groupId: string) => {
    const name = editingGroupName.trim()
    if (name) {
      await updateGroup(groupId, { name })
    }
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const toggleCollapse = async (group: PlanGroup) => {
    await updateGroup(group.id, { collapsed: !group.collapsed })
  }

  const getPlansForGroup = (groupId: string): Plan[] => {
    return plans.filter((p) => assignments[p.id] === groupId)
  }

  const getUngroupedPlans = (): Plan[] => {
    return plans.filter((p) => !assignments[p.id])
  }

  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)
  const activePlan = plans.find((p) => p.id === activePlanId)

  const renderPlanItem = (plan: Plan) => (
    <div key={plan.id}>
      {deletingId === plan.id ? (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <span className="text-[10px] text-[var(--color-text-muted)] flex-1 truncate">
            确认删除？
          </span>
          <button
            onClick={async () => {
              await deletePlan(plan.id)
              setDeletingId(null)
            }}
            className="no-drag text-[10px] text-[var(--color-error)] hover:underline cursor-pointer"
          >
            删除
          </button>
          <button
            onClick={() => setDeletingId(null)}
            className="no-drag text-[10px] text-[var(--color-text-muted)] hover:underline cursor-pointer"
          >
            取消
          </button>
        </div>
      ) : (
        <div
          draggable
          onDragStart={(e) => handlePlanDragStart(e, plan.id)}
          onDragEnd={handlePlanDragEnd}
          onClick={() => openPlan(plan.id)}
          className={cn(
            'no-drag w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer group',
            'flex items-center gap-2 select-none',
            activePlanId === plan.id
              ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]',
            draggedPlanId === plan.id && 'opacity-40'
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="flex-1 truncate">{plan.title}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
              copiedId === plan.id
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            )}
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(plan.filePath)
              setCopiedId(plan.id)
              setTimeout(() => setCopiedId((prev) => (prev === plan.id ? null : prev)), 1500)
            }}
          >
            {copiedId === plan.id ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 1 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-opacity cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              setDeletingId(plan.id)
            }}
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </div>
      )}
    </div>
  )

  return (
    <div
      className="flex flex-1 overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault()
        if (!draggedPlanId) setDragOver(true)
      }}
      onDragLeave={() => {
        if (!draggedPlanId) setDragOver(false)
      }}
      onDrop={(e) => {
        if (draggedPlanId) return
        handleFileDrop(e)
      }}
    >
      <div className="w-56 shrink-0 border-r border-[var(--color-border-subtle)] flex flex-col">
        <div className="p-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">计划</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowGroupInput(true)}
                className="no-drag w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                title="新建分组"
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
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </button>
              <button
                onClick={() => setShowNewInput(true)}
                className="no-drag w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                title="新建计划"
              >
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
              </button>
            </div>
          </div>

          {showGroupInput && (
            <input
              ref={groupInputRef}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateGroup()
                if (e.key === 'Escape') {
                  setShowGroupInput(false)
                  setNewGroupName('')
                }
              }}
              onBlur={() => {
                if (!newGroupName.trim()) {
                  setShowGroupInput(false)
                  setNewGroupName('')
                }
              }}
              placeholder="输入分组名称…"
              className={cn(
                'no-drag w-full h-7 rounded-md border border-[var(--color-border)] px-2 text-xs mb-1',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                'bg-[var(--color-bg-surface-2)] outline-none transition-colors',
                'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30'
              )}
            />
          )}

          {showNewInput && (
            <input
              ref={newInputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowNewInput(false)
                  setNewTitle('')
                }
              }}
              onBlur={() => {
                if (!newTitle.trim()) {
                  setShowNewInput(false)
                  setNewTitle('')
                }
              }}
              placeholder="输入计划名称…"
              className={cn(
                'no-drag w-full h-7 rounded-md border border-[var(--color-border)] px-2 text-xs',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                'bg-[var(--color-bg-surface-2)] outline-none transition-colors',
                'focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30'
              )}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {plans.length === 0 && groups.length === 0 && !loading && (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-8 px-2">
              暂无计划
              <br />
              <span className="text-[10px]">点击 + 新建，或拖放 .md 文件导入</span>
            </p>
          )}

          {sortedGroups.map((group) => {
            const groupPlans = getPlansForGroup(group.id)
            return (
              <div key={group.id} className="mb-1">
                <div
                  className={cn(
                    'flex items-center gap-1 px-1 py-1 rounded-md group/header transition-colors',
                    dropTargetGroupId === group.id &&
                      'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/30'
                  )}
                  onDragOver={(e) => handleGroupDragOver(e, group.id)}
                  onDragLeave={handleGroupDragLeave}
                  onDrop={(e) => handleGroupDrop(e, group.id)}
                >
                  <button
                    onClick={() => toggleCollapse(group)}
                    className="no-drag shrink-0 w-4 h-4 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        'transition-transform duration-150',
                        group.collapsed ? '' : 'rotate-90'
                      )}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>

                  {editingGroupId === group.id ? (
                    <input
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameGroup(group.id)
                        if (e.key === 'Escape') {
                          setEditingGroupId(null)
                          setEditingGroupName('')
                        }
                      }}
                      onBlur={() => handleRenameGroup(group.id)}
                      className="no-drag flex-1 h-5 bg-transparent border-b border-[var(--color-accent)] text-xs text-[var(--color-text-primary)] outline-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-[11px] font-medium text-[var(--color-text-muted)] truncate cursor-default select-none"
                      onDoubleClick={() => {
                        setEditingGroupId(group.id)
                        setEditingGroupName(group.name)
                      }}
                    >
                      {group.name}
                    </span>
                  )}

                  <span className="text-[10px] text-[var(--color-text-muted)]/60 tabular-nums">
                    {groupPlans.length}
                  </span>

                  <div className="opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setEditingGroupId(group.id)
                        setEditingGroupName(group.name)
                      }}
                      className="no-drag w-4 h-4 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="no-drag w-4 h-4 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-error)] cursor-pointer"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {!group.collapsed && (
                  <div className="ml-3 space-y-0.5 mt-0.5">
                    {groupPlans.length === 0 && (
                      <p className="text-[10px] text-[var(--color-text-muted)]/50 px-2 py-1">
                        拖入计划到此处
                      </p>
                    )}
                    {groupPlans.map((plan) => renderPlanItem(plan))}
                  </div>
                )}
              </div>
            )
          })}

          {(() => {
            const ungrouped = getUngroupedPlans()
            if (ungrouped.length === 0 && sortedGroups.length > 0) return null
            return (
              <div className="mt-2">
                {sortedGroups.length > 0 && (
                  <div
                    className={cn(
                      'flex items-center gap-1 px-1 py-1 mb-0.5 rounded-md',
                      dropTargetGroupId === '__ungrouped__' &&
                        'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/30'
                    )}
                    onDragOver={handleUngroupedDragOver}
                    onDragLeave={() => setDropTargetGroupId(null)}
                    onDrop={handleUngroupedDrop}
                  >
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)]/70 select-none">
                      未分组
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]/60 tabular-nums">
                      {ungrouped.length}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">{ungrouped.map((plan) => renderPlanItem(plan))}</div>
              </div>
            )
          })()}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activePlan ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)]">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {activePlan.title}
                {isDirty && (
                  <span className="ml-1.5 text-[10px] text-[var(--color-accent)]">未保存</span>
                )}
              </span>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className={cn(
                  'no-drag px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                  isDirty && !saving
                    ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
                    : 'text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] cursor-default'
                )}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
            <textarea
              value={editorContent}
              onChange={(e) => updateEditorContent(e.target.value)}
              className={cn(
                'no-drag flex-1 w-full resize-none p-4 text-sm leading-relaxed',
                'text-[var(--color-text-primary)] bg-transparent outline-none',
                'font-mono'
              )}
              placeholder="在此编辑内容…"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-xs text-[var(--color-text-muted)]">选择或新建一个计划开始编辑</p>
            </div>
          </div>
        )}
      </div>

      {dragOver && !draggedPlanId && (
        <div className="absolute inset-0 z-30 bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)]/50 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-sm text-[var(--color-accent)] font-medium">松开导入 .md 文件</p>
        </div>
      )}
    </div>
  )
}
