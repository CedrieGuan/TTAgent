import { ipcMain } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse, MCPCallToolPayload, MCPConnectPayload } from '@shared/types/ipc.types'
import type { MCPServerStatus, MCPTool } from '@shared/types/mcp.types'

// 活跃的 MCP 客户端连接
const mcpClients = new Map<string, Client>()

export { mcpClients }

export function registerMCPHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_SERVERS, (): IPCResponse<MCPServerStatus[]> => {
    const servers = store.get('mcpServers') ?? []
    const statuses: MCPServerStatus[] = servers.map((s) => ({
      name: s.name,
      connected: mcpClients.has(s.name),
      tools: [],
      error: undefined
    }))
    return { success: true, data: statuses }
  })

  ipcMain.handle(IPC_CHANNELS.MCP_LIST_TOOLS, async (): Promise<IPCResponse<MCPTool[]>> => {
    const allTools: MCPTool[] = []
    for (const [, client] of mcpClients) {
      try {
        const result = await client.listTools()
        allTools.push(...(result.tools as MCPTool[]))
      } catch {
        // 跳过断开的服务器
      }
    }
    return { success: true, data: allTools }
  })

  ipcMain.handle(
    IPC_CHANNELS.MCP_CONNECT_SERVER,
    async (_event, payload: MCPConnectPayload): Promise<IPCResponse> => {
      try {
        if (mcpClients.has(payload.name)) {
          await mcpClients.get(payload.name)!.close()
          mcpClients.delete(payload.name)
        }

        const transport = new StdioClientTransport({
          command: payload.command,
          args: payload.args,
          env: { ...process.env, ...(payload.env ?? {}) } as Record<string, string>
        })

        const client = new Client({ name: 'TTAgent', version: '0.1.0' }, { capabilities: {} })
        await client.connect(transport)
        mcpClients.set(payload.name, client)

        // 持久化服务器配置
        const servers = store.get('mcpServers') ?? []
        const existing = servers.findIndex((s) => s.name === payload.name)
        const config = {
          name: payload.name,
          command: payload.command,
          args: payload.args,
          env: payload.env,
          enabled: true
        }
        if (existing >= 0) servers[existing] = config
        else servers.push(config)
        store.set('mcpServers', servers)

        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MCP_DISCONNECT_SERVER,
    async (_event, name: string): Promise<IPCResponse> => {
      try {
        await mcpClients.get(name)?.close()
        mcpClients.delete(name)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MCP_CALL_TOOL,
    async (_event, payload: MCPCallToolPayload): Promise<IPCResponse> => {
      const client = mcpClients.get(payload.serverName)
      if (!client)
        return { success: false, error: `MCP server "${payload.serverName}" not connected` }
      try {
        const result = await client.callTool({ name: payload.name, arguments: payload.args })
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
