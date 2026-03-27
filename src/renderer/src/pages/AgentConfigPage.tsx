import React, { useState } from 'react'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import { useSkillStore } from '@stores/skill.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

export function AgentConfigPage() {
  const { agentSystemPrompt, updateAgentSystemPrompt } = useSettingsStore()
  const { mcpServers, connectServer, disconnectServer, loadMCPServers } = useAgentStore()
  const { summaries, discovering, discoverSkills, openSkillDir } = useSkillStore()
  const [prompt, setPrompt] = useState(agentSystemPrompt)
  const [promptSaved, setPromptSaved] = useState(false)

  // MCP 新服务器表单
  const [serverName, setServerName] = useState('')
  const [serverCommand, setServerCommand] = useState('')
  const [serverArgs, setServerArgs] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Skills 展开状态
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [expandedInstructions, setExpandedInstructions] = useState('')

  React.useEffect(() => {
    loadMCPServers()
  }, [loadMCPServers])

  React.useEffect(() => {
    discoverSkills()
  }, [discoverSkills])

  const handleSavePrompt = async () => {
    await updateAgentSystemPrompt(prompt)
    setPromptSaved(true)
    setTimeout(() => setPromptSaved(false), 2000)
  }

  const handleConnectServer = async () => {
    if (!serverName || !serverCommand) return
    setConnecting(true)
    const ok = await connectServer({
      name: serverName,
      command: serverCommand,
      args: serverArgs ? serverArgs.split(' ') : undefined
    })
    if (ok) {
      setServerName('')
      setServerCommand('')
      setServerArgs('')
    }
    setConnecting(false)
  }

  const handleToggleExpand = async (skillId: string) => {
    if (expandedSkill === skillId) {
      setExpandedSkill(null)
      setExpandedInstructions('')
    } else {
      setExpandedSkill(skillId)
      setExpandedInstructions('加载中...')
      const res = await window.api.loadSkill(skillId)
      if (res.success && res.data) {
        setExpandedInstructions(res.data.instructions)
      } else {
        setExpandedInstructions('加载失败')
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-8 space-y-8">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Agent 配置</h1>

        {/* System Prompt */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            系统提示词
          </h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="no-drag w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 resize-y"
            placeholder="You are a helpful AI assistant."
          />
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={handleSavePrompt}>
              保存
            </Button>
            {promptSaved && <span className="text-sm text-[var(--color-success)]">已保存</span>}
          </div>
        </section>

        {/* Skills（文件技能） */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Skills
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                loading={discovering}
                onClick={() => discoverSkills()}
              >
                刷新
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openSkillDir()}>
                打开文件夹
              </Button>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            技能以 SKILL.md 文件定义在技能目录中。点击「打开文件夹」创建或编辑技能，使用 /技能名
            在聊天中触发。
          </p>

          {summaries.length > 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
              {summaries.map((skill) => (
                <div key={skill.id}>
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors duration-150"
                    onClick={() => handleToggleExpand(skill.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            /{skill.name}
                          </span>
                          {skill.disableModelInvocation && (
                            <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                              仅手动
                            </span>
                          )}
                        </div>
                        {skill.description && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <svg
                        className="h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0"
                        style={{
                          transform:
                            expandedSkill === skill.id ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>

                  {expandedSkill === skill.id && (
                    <div className="px-4 pb-3 pt-1 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                            指令内容
                          </label>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {skill.filePath}
                          </span>
                        </div>
                        <pre className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap overflow-auto max-h-64">
                          {expandedInstructions}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {discovering
                  ? '正在扫描技能目录...'
                  : '暂无 Skill，点击「打开文件夹」创建 SKILL.md'}
              </p>
            </div>
          )}
        </section>

        {/* MCP 服务器 */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            MCP 工具服务器
          </h2>

          {/* 已连接的服务器 */}
          {mcpServers.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
              {mcpServers.map((server) => (
                <div key={server.name} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${server.connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`}
                    />
                    <span className="text-sm text-[var(--color-text-primary)]">{server.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {server.tools.length} 个工具
                    </span>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => disconnectServer(server.name)}>
                    断开
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 添加新服务器 */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              添加 MCP 服务器
            </h3>
            <Input
              label="名称"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="my-tools"
            />
            <Input
              label="启动命令"
              value={serverCommand}
              onChange={(e) => setServerCommand(e.target.value)}
              placeholder="npx / python / node ..."
            />
            <Input
              label="参数（空格分隔）"
              value={serverArgs}
              onChange={(e) => setServerArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
            />
            <Button
              variant="primary"
              loading={connecting}
              disabled={!serverName || !serverCommand}
              onClick={handleConnectServer}
            >
              连接服务器
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
