import React, { useState } from 'react'
import { useAgentStore } from '@stores/agent.store'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'

export function MCPPage() {
  const { mcpServers, connectServer, disconnectServer, loadMCPServers } = useAgentStore()
  const [serverName, setServerName] = useState('')
  const [serverCommand, setServerCommand] = useState('')
  const [serverArgs, setServerArgs] = useState('')
  const [connecting, setConnecting] = useState(false)

  React.useEffect(() => {
    loadMCPServers()
  }, [loadMCPServers])

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
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">MCP 工具服务器</h1>

        {mcpServers.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              已连接的服务器
            </h2>
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
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            添加 MCP 服务器
          </h2>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
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
