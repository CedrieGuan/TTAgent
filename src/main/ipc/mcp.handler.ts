/**
 * MCP 服务器 IPC Handler
 * 管理 MCP 服务器的连接、断开和工具调用
 * 使用 StdioClientTransport 通过子进程与 MCP 服务器通信
 */
import { ipcMain } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { store } from '../store'
import { logger } from '../logger'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse, MCPCallToolPayload, MCPConnectPayload } from '@shared/types/ipc.types'
import type { MCPServerStatus, MCPTool } from '@shared/types/mcp.types'

/** 活跃的 MCP 客户端连接（服务器名称 -> Client 实例） */
const mcpClients = new Map<string, Client>()

export { mcpClients }

export function registerMCPHandlers(): void {
  /** 获取所有已配置服务器的状态（含连接状态） */
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

  /** 获取所有已连接服务器提供的工具列表 */
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_TOOLS, async (): Promise<IPCResponse<MCPTool[]>> => {
    const allTools: MCPTool[] = []
    for (const [, client] of mcpClients) {
      try {
        const result = await client.listTools()
        allTools.push(...(result.tools as MCPTool[]))
      } catch (err) {
        logger.mcp.warn('列出MCP工具失败:', err instanceof Error ? err.message : String(err))
        continue
      }
    }
    return { success: true, data: allTools }
  })

  /** 连接 MCP 服务器（若已连接则先断开重连），并持久化配置 */
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
        logger.mcp.info('MCP服务器已连接:', payload.name)
        return { success: true }
      } catch (err) {
        logger.mcp.error('连接MCP服务器失败:', payload.name, err)
        return { success: false, error: String(err) }
      }
    }
  )

  /** 断开指定 MCP 服务器的连接 */
  ipcMain.handle(
    IPC_CHANNELS.MCP_DISCONNECT_SERVER,
    async (_event, name: string): Promise<IPCResponse> => {
      try {
        await mcpClients.get(name)?.close()
        mcpClients.delete(name)
        logger.mcp.info('MCP服务器已断开:', name)
        return { success: true }
      } catch (err) {
        logger.mcp.error('断开MCP服务器失败:', name, err)
        return { success: false, error: String(err) }
      }
    }
  )

  /** 直接调用指定服务器上的工具（用于调试或手动触发） */
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
        logger.mcp.error('调用MCP工具失败:', payload.name, err)
        return { success: false, error: String(err) }
      }
    }
  )
}
