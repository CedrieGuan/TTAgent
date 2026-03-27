export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
}

export interface MCPServerStatus {
  name: string
  connected: boolean
  tools: MCPTool[]
  error?: string
}
