import Anthropic from '@anthropic-ai/sdk'
import type { MCPTool } from '@shared/types/mcp.types'

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
