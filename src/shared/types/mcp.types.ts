/** MCP 工具定义（符合 MCP 协议规范） */
export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

/** MCP 服务器持久化配置 */
export interface MCPServerConfig {
  name: string
  /** 启动服务器的可执行命令 */
  command: string
  args?: string[]
  /** 传递给服务器进程的环境变量 */
  env?: Record<string, string>
  enabled: boolean
}

/** MCP 服务器运行时状态 */
export interface MCPServerStatus {
  name: string
  connected: boolean
  tools: MCPTool[]
  error?: string
}
