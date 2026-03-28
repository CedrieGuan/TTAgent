import React, { useState } from 'react'
import { useMemoryStore } from '@stores/memory.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { formatTime } from '@lib/utils'

export function MemoryPage() {
  const {
    globalMemories,
    workspaceMemories,
    workspacePath,
    loadMemories,
    setWorkspacePath,
    deleteMemory,
    clearMemories,
    loaded
  } = useMemoryStore()

  const [pathInput, setPathInput] = useState(workspacePath)
  const [pathSaved, setPathSaved] = useState(false)

  React.useEffect(() => {
    if (!loaded) {
      loadMemories()
    }
  }, [loaded, loadMemories])

  React.useEffect(() => {
    setPathInput(workspacePath)
  }, [workspacePath])

  const handleSavePath = async () => {
    await setWorkspacePath(pathInput)
    setPathSaved(true)
    setTimeout(() => setPathSaved(false), 2000)
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-8 space-y-8">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">记忆管理</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            工作区路径
          </h2>
          <div className="flex items-end gap-2">
            <Input
              label="工作区路径（用于项目级记忆）"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/path/to/your/project"
            />
            <Button variant="primary" onClick={handleSavePath} className="shrink-0">
              保存
            </Button>
          </div>
          {pathSaved && <span className="text-sm text-[var(--color-success)]">已保存</span>}
          <p className="text-xs text-[var(--color-text-muted)]">
            设置工作区路径后，AI
            会自动从对话中提取项目相关记忆（架构决策、代码约定等）并保存到工作区。
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              全局记忆
            </h2>
            {globalMemories.length > 0 && (
              <Button variant="danger" size="sm" onClick={() => clearMemories('global')}>
                清空
              </Button>
            )}
          </div>
          {globalMemories.length > 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
              {globalMemories.map((m) => (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)]">{m.content}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory('global', m.id)}
                    className="no-drag shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                    title="删除"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">暂无全局记忆</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                AI 会在对话中自动提取关于您的偏好和习惯
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              工作区记忆
              {workspacePath && (
                <span className="ml-2 text-[10px] font-normal text-[var(--color-text-muted)]">
                  {workspacePath.split('/').pop()}
                </span>
              )}
            </h2>
            {workspaceMemories.length > 0 && (
              <Button variant="danger" size="sm" onClick={() => clearMemories('workspace')}>
                清空
              </Button>
            )}
          </div>
          {!workspacePath ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">请先设置工作区路径</p>
            </div>
          ) : workspaceMemories.length > 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
              {workspaceMemories.map((m) => (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)]">{m.content}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {formatTime(m.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory('workspace', m.id)}
                    className="no-drag shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                    title="删除"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">暂无工作区记忆</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                AI 会在对话中自动提取项目架构和代码约定
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
