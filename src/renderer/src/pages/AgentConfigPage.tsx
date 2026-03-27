import React, { useState } from 'react'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import { useSkillStore } from '@stores/skill.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

export function AgentConfigPage() {
  const { agentSystemPrompt, updateAgentSystemPrompt } = useSettingsStore()
  const { mcpServers, connectServer, disconnectServer, loadMCPServers } = useAgentStore()
  const { skills, loadSkills, createSkill, updateSkill, deleteSkill, toggleSkill } = useSkillStore()
  const [prompt, setPrompt] = useState(agentSystemPrompt)
  const [promptSaved, setPromptSaved] = useState(false)

  // MCP 新服务器表单
  const [serverName, setServerName] = useState('')
  const [serverCommand, setServerCommand] = useState('')
  const [serverArgs, setServerArgs] = useState('')
  const [connecting, setConnecting] = useState(false)

  // Skills 表单
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [skillName, setSkillName] = useState('')
  const [skillDesc, setSkillDesc] = useState('')
  const [skillInstructions, setSkillInstructions] = useState('')
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [editInstructions, setEditInstructions] = useState('')
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [savingSkill, setSavingSkill] = useState<string | null>(null)

  React.useEffect(() => {
    loadMCPServers()
  }, [loadMCPServers])

  React.useEffect(() => {
    loadSkills()
  }, [loadSkills])

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

  const handleCreateSkill = async () => {
    if (!skillName.trim()) return
    setCreatingSkill(true)
    const result = await createSkill({
      name: skillName.trim(),
      description: skillDesc.trim(),
      instructions: skillInstructions.trim(),
      enabled: true
    })
    if (result) {
      setSkillName('')
      setSkillDesc('')
      setSkillInstructions('')
      setShowSkillForm(false)
    }
    setCreatingSkill(false)
  }

  const handleToggleExpand = (skillId: string, currentInstructions: string) => {
    if (expandedSkill === skillId) {
      setExpandedSkill(null)
      setEditInstructions('')
      setSavingSkill(null)
    } else {
      setExpandedSkill(skillId)
      setEditInstructions(currentInstructions)
    }
  }

  const handleSaveInstructions = async (skillId: string) => {
    setSavingSkill(skillId)
    await updateSkill(skillId, { instructions: editInstructions })
    setSavingSkill(null)
  }

  const handleDeleteSkill = async (skillId: string) => {
    await deleteSkill(skillId)
    if (expandedSkill === skillId) {
      setExpandedSkill(null)
      setEditInstructions('')
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

        {/* Skills */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Skills
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowSkillForm(!showSkillForm)}>
              {showSkillForm ? '取消' : '添加 Skill'}
            </Button>
          </div>

          {showSkillForm && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
              <Input
                label="名称"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="我的自定义 Skill"
              />
              <Input
                label="描述"
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                placeholder="简要描述此 Skill 的用途"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  指令
                </label>
                <textarea
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  rows={5}
                  className="no-drag w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 resize-y"
                  placeholder="当用户请求...时，你应该..."
                />
              </div>
              <Button
                variant="primary"
                loading={creatingSkill}
                disabled={!skillName.trim()}
                onClick={handleCreateSkill}
              >
                创建
              </Button>
            </div>
          )}

          {skills.length > 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
              {skills.map((skill) => (
                <div key={skill.id}>
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors duration-150"
                    onClick={() => handleToggleExpand(skill.id, skill.instructions)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        className="no-drag relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200"
                        style={{
                          backgroundColor: skill.enabled
                            ? 'var(--color-accent)'
                            : 'var(--color-border)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSkill(skill.id, !skill.enabled)
                        }}
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-full bg-white transition-transform duration-200"
                          style={{
                            transform: skill.enabled ? 'translateX(14px)' : 'translateX(2px)'
                          }}
                        />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {skill.name}
                          </span>
                          {skill.isBuiltIn && (
                            <span className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
                              内置
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
                      {!skill.isBuiltIn && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSkill(skill.id)
                          }}
                        >
                          删除
                        </Button>
                      )}
                      <svg
                        className="h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0"
                        style={{
                          transform: expandedSkill === skill.id ? 'rotate(180deg)' : 'rotate(0deg)'
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
                        <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                          指令内容
                        </label>
                        <textarea
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          rows={6}
                          className="no-drag w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 resize-y"
                          readOnly={skill.isBuiltIn}
                        />
                        {!skill.isBuiltIn && (
                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={savingSkill === skill.id}
                              onClick={() => handleSaveInstructions(skill.id)}
                            >
                              保存指令
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">暂无 Skill，点击上方按钮添加</p>
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
