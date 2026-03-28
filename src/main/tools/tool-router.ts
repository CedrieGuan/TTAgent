/**
 * 工具路由模块
 * 根据工具名称前缀决定调用本地工具还是 MCP 服务器工具
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getLocalToolExecutor, isLocalTool, getLocalTools } from './local-tools'
import { logger } from '../logger'
import type { MCPTool } from '@shared/types/mcp.types'

/** 工具调用结果 */
export interface ToolCallResult {
  output: string
  isError: boolean
}

export class ToolRouter {
  private mcpClients: Map<string, Client>

  constructor(mcpClients: Map<string, Client>) {
    this.mcpClients = mcpClients
  }

  /**
   * 执行工具调用
   * 根据工具名称前缀自动路由到本地工具或 MCP 服务器工具
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (isLocalTool(name)) {
      return this.executeLocalTool(name, args)
    }
    return this.executeMCPTool(name, args)
  }

  /** 执行本地内置工具 */
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

  /**
   * 执行 MCP 服务器工具
   * 遍历所有已连接的 MCP 客户端，找到提供该工具的服务器并调用
   */
  private async executeMCPTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolCallResult> {
    for (const [, client] of this.mcpClients) {
      try {
        const { tools } = await client.listTools()
        if (tools.some((t) => t.name === name)) {
          const result = await client.callTool({ name, arguments: args })
          // 将工具返回的内容统一转换为字符串
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
      } catch (err) {
        logger.tool.warn(`MCP工具 ${name} 调用失败:`, err instanceof Error ? err.message : String(err))
      }
    }
    return { output: `No MCP server found for tool: ${name}`, isError: true }
  }

  /** 合并本地工具和 MCP 工具，本地工具优先排列 */
  mergeTools(mcpTools: MCPTool[]): MCPTool[] {
    return [...getLocalTools(), ...mcpTools]
  }
}
