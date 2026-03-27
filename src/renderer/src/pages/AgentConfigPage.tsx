import React, { useState } from 'react'
import { useSettingsStore } from '@stores/settings.store'
import { useAgentStore } from '@stores/agent.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

export function AgentConfigPage() {
  const { agentSystemPrompt, updateAgentSystemPrompt } = useSettingsStore()
  const { mcpServers, connectServer, disconnectServer, loadMCPServers } = useAgentStore()
  const [prompt, setPrompt] = useState(agentSystemPrompt)
  const [promptSaved, setPromptSaved] = useState(false)

  // MCP 新服务器表单
  const [serverName, setServerName] = useState('')
  const [serverCommand, setServerCommand] = useState('')
  const [serverArgs, setServerArgs] = useState('')
  const [connecting, setConnecting] = useState(false)

  React.useEffect(() => {
    loadMCPServers()
  }, [loadMCPServers])

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
            <Button variant="primary" onClick={handleSavePrompt}>保存</Button>
            {promptSaved && <span className="text-sm text-[var(--color-success)]">已保存</span>}
          </div>
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
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => disconnectServer(server.name)}
                  >
                    断开
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 添加新服务器 */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">添加 MCP 服务器</h3>
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
