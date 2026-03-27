import { create } from 'zustand'
import type { MCPServerStatus, MCPTool } from '@shared/types/mcp.types'
import type { MCPConnectPayload } from '@shared/types/ipc.types'

interface AgentState {
  mcpServers: MCPServerStatus[]
  allTools: MCPTool[]
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

  loadMCPServers: async () => {
    const res = await window.api.listMCPServers()
    if (res.success && res.data) {
      set({ mcpServers: res.data })
    }
  },

  connectServer: async (payload) => {
    const res = await window.api.connectMCPServer(payload)
    if (res.success) {
      // 刷新服务器列表和工具列表
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

  disconnectServer: async (name) => {
    await window.api.disconnectMCPServer(name)
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.name !== name)
    }))
  },

  refreshTools: async () => {
    const res = await window.api.listMCPTools()
    if (res.success && res.data) {
      set({ allTools: res.data })
    }
  },

  setToolsEnabled: (enabled) => set({ toolsEnabled: enabled })
}))
