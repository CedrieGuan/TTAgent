/**
 * 工具 Schema 转换模块
 * 将统一的 MCPTool 格式转换为各 AI 提供商所需的工具定义格式
 */
import Anthropic from '@anthropic-ai/sdk'
import type { MCPTool } from '@shared/types/mcp.types'

/** 将 MCPTool 列表转换为 Anthropic SDK 所需的工具格式 */
export function toAnthropicTools(tools: MCPTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      ...(tool.inputSchema.properties && { properties: tool.inputSchema.properties }),
      ...(tool.inputSchema.required && { required: tool.inputSchema.required })
    }
  }))
}

interface OpenAIToolFunction {
  name: string
  description?: string
  parameters: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface OpenAITool {
  type: 'function'
  function: OpenAIToolFunction
}

/** 将 MCPTool 列表转换为 OpenAI / 兼容接口所需的工具格式（同样适用于智谱 AI） */
export function toOpenAITools(tools: MCPTool[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        ...(tool.inputSchema.properties && { properties: tool.inputSchema.properties }),
        ...(tool.inputSchema.required && { required: tool.inputSchema.required })
      }
    }
  }))
}
