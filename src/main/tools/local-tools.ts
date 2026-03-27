/**
 * 本地内置工具模块
 * 提供文件读写、目录列表、Shell 命令执行等本地能力
 * 工具名称统一以 "local_" 前缀标识
 */
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { resolve, join, dirname } from 'path'
import { homedir } from 'os'
import type { MCPTool } from '@shared/types/mcp.types'

/** 本地工具执行器接口 */
export interface LocalToolExecutor {
  execute(args: Record<string, unknown>): Promise<string>
}

interface LocalToolDefinition {
  tool: MCPTool
  executor: LocalToolExecutor
}

const LOCAL_TOOL_PREFIX = 'local_'

function localTool(name: string): string {
  return `${LOCAL_TOOL_PREFIX}${name}`
}

/** 判断工具名称是否为本地工具 */
export function isLocalTool(toolName: string): boolean {
  return toolName.startsWith(LOCAL_TOOL_PREFIX)
}

// ── 工具定义 ──────────────────────────────────────────────────

/** 读取文件内容，支持行号偏移和行数限制 */
const readFileDef: LocalToolDefinition = {
  tool: {
    name: localTool('read_file'),
    description: 'Read the contents of a file at the given path. Returns the file content as text.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to read'
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed). Defaults to 1.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read. Defaults to 2000.'
        }
      },
      required: ['path']
    }
  },
  executor: {
    async execute(args) {
      const filePath = resolvePath(args.path as string)
      if (!existsSync(filePath)) return `Error: File not found: ${filePath}`
      try {
        const content = await readFile(filePath, 'utf-8')
        const lines = content.split('\n')
        const offset = Math.max(1, (args.offset as number) ?? 1)
        const limit = (args.limit as number) ?? 2000
        const sliced = lines.slice(offset - 1, offset - 1 + limit)
        // 返回带行号的内容，便于 AI 精确引用
        return sliced.map((line, i) => `${offset + i}: ${line}`).join('\n')
      } catch (err) {
        return `Error reading file: ${(err as Error).message}`
      }
    }
  }
}

/** 写入文件内容，自动创建父目录 */
const writeFileDef: LocalToolDefinition = {
  tool: {
    name: localTool('write_file'),
    description:
      'Write content to a file. Creates the file and any parent directories if they do not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to write'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  executor: {
    async execute(args) {
      const filePath = resolvePath(args.path as string)
      const content = args.content as string
      try {
        const dir = dirname(filePath)
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true })
        }
        await writeFile(filePath, content, 'utf-8')
        return `Successfully wrote ${content.length} bytes to ${filePath}`
      } catch (err) {
        return `Error writing file: ${(err as Error).message}`
      }
    }
  }
}

/** 列出目录内容，目录名后附加 "/" 标识 */
const listDirectoryDef: LocalToolDefinition = {
  tool: {
    name: localTool('list_directory'),
    description:
      'List files and directories at the given path. Returns entries with type indicator (/ for directories).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the directory to list'
        }
      },
      required: ['path']
    }
  },
  executor: {
    async execute(args) {
      const dirPath = resolvePath(args.path as string)
      if (!existsSync(dirPath)) return `Error: Directory not found: ${dirPath}`
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        return entries.map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`).join('\n')
      } catch (err) {
        return `Error listing directory: ${(err as Error).message}`
      }
    }
  }
}

/** 执行 Shell 命令，返回 stdout + stderr，支持超时控制 */
const shellExecuteDef: LocalToolDefinition = {
  tool: {
    name: localTool('shell_execute'),
    description:
      'Execute a shell command and return its stdout and stderr. Use for running build commands, tests, git operations, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command. Defaults to the project root.'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes).'
        }
      },
      required: ['command']
    }
  },
  executor: {
    async execute(args) {
      const command = args.command as string
      const cwd = args.cwd ? resolvePath(args.cwd as string) : undefined
      const timeout = (args.timeout as number) ?? 120000

      try {
        const result = await new Promise<string>((resolvePromise) => {
          execFile(
            'sh',
            ['-c', command],
            { cwd, timeout, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
              let output = ''
              if (stdout) output += stdout
              if (stderr) output += (output ? '\n' : '') + stderr
              if (error) {
                output += (output ? '\n' : '') + `Exit code: ${error.code ?? 'unknown'}`
              }
              resolvePromise(output)
            }
          )
        })
        return result || '(no output)'
      } catch (err) {
        return `Error executing command: ${(err as Error).message}`
      }
    }
  }
}

/** 所有本地工具定义列表 */
const LOCAL_TOOLS: LocalToolDefinition[] = [
  readFileDef,
  writeFileDef,
  listDirectoryDef,
  shellExecuteDef
]

/** 工具名称 -> 执行器的快速查找 Map */
const executorMap = new Map(LOCAL_TOOLS.map((def) => [def.tool.name, def.executor]))

/** 获取所有本地工具的 MCPTool 定义列表 */
export function getLocalTools(): MCPTool[] {
  return LOCAL_TOOLS.map((def) => def.tool)
}

/** 根据工具名称获取对应的执行器 */
export function getLocalToolExecutor(toolName: string): LocalToolExecutor | undefined {
  return executorMap.get(toolName)
}

/** 解析路径：支持 ~ 展开为用户主目录，其余使用 resolve 转为绝对路径 */
function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1))
  }
  return resolve(inputPath)
}
