import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getLocalToolExecutor, isLocalTool } from './local-tools'
import { getLocalTools } from './local-tools'
import type { MCPTool } from '@shared/types/mcp.types'

export interface ToolCallResult {
  output: string
  isError: boolean
}

export class ToolRouter {
  private mcpClients: Map<string, Client>

  constructor(mcpClients: Map<string, Client>) {
    this.mcpClients = mcpClients
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (isLocalTool(name)) {
      return this.executeLocalTool(name, args)
    }
    return this.executeMCPTool(name, args)
  }

  private async executeLocalTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const executor = getLocalToolExecutor(name)
    if (!executor) {
      return { output: `Unknown local tool: ${name}`, isError: true }
    }
    try {
      const output = await executor.execute(args)
      return { output, isError: false }
    } catch (err) {
      return { output: `Local tool error: ${(err as Error).message}`, isError: true }
    }
  }

  private async executeMCPTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    for (const [, client] of this.mcpClients) {
      try {
        const { tools } = await client.listTools()
        if (tools.some((t) => t.name === name)) {
          const result = await client.callTool({ name, arguments: args })
          const textContent =
            typeof result.content === 'string'
              ? result.content
              : Array.isArray(result.content)
                ? result.content
                    .map((c: unknown) =>
                      typeof c === 'string'
                        ? c
                        : ((c as { text?: string }).text ?? JSON.stringify(c))
                    )
                    .join('\n')
                : JSON.stringify(result.content)
          return { output: textContent, isError: result.isError === true }
        }
      } catch {
        continue
      }
    }
    return { output: `No MCP server found for tool: ${name}`, isError: true }
  }

  mergeTools(mcpTools: MCPTool[]): MCPTool[] {
    return [...getLocalTools(), ...mcpTools]
  }
}
