/**
 * Agent Store（MCP 工具管理）
 * 管理 MCP 服务器连接状态和可用工具列表
 */
import { create } from 'zustand'
import type { MCPServerStatus, MCPTool } from '@shared/types/mcp.types'
import type { MCPConnectPayload } from '@shared/types/ipc.types'

interface AgentState {
  mcpServers: MCPServerStatus[]
  allTools: MCPTool[]
  /** 是否启用工具调用（全局开关） */
  toolsEnabled: boolean

  loadMCPServers: () => Promise<void>
  connectServer: (payload: MCPConnectPayload) => Promise<boolean>
  disconnectServer: (name: string) => Promise<void>
  refreshTools: () => Promise<void>
  setToolsEnabled: (enabled: boolean) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  mcpServers: [],
  allTools: [],
  toolsEnabled: true,

  /** 从主进程加载所有已配置的 MCP 服务器状态 */
  loadMCPServers: async () => {
    const res = await window.api.listMCPServers()
    if (res.success && res.data) {
      set({ mcpServers: res.data })
    }
  },

  /** 连接 MCP 服务器，成功后同步刷新服务器列表和工具列表 */
  connectServer: async (payload) => {
    const res = await window.api.connectMCPServer(payload)
    if (res.success) {
      const [serversRes, toolsRes] = await Promise.all([
        window.api.listMCPServers(),
        window.api.listMCPTools()
      ])
      set({
        mcpServers: serversRes.data ?? [],
        allTools: toolsRes.data ?? []
      })
      return true
    }
    return false
  },

  /** 断开 MCP 服务器连接，并从列表中移除 */
  disconnectServer: async (name) => {
    await window.api.disconnectMCPServer(name)
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.name !== name)
    }))
  },

  /** 刷新所有已连接服务器的工具列表 */
  refreshTools: async () => {
    const res = await window.api.listMCPTools()
    if (res.success && res.data) {
      set({ allTools: res.data })
    }
  },

  setToolsEnabled: (enabled) => set({ toolsEnabled: enabled })
}))
