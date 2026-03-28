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
import { taskManager } from '../task/task-manager'
import { broadcastTaskEvent } from '../ipc/task.handler'

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

/** 在任务大厅创建新任务（AI 自动调用，非危险工具） */
const createTaskDef: LocalToolDefinition = {
  tool: {
    name: localTool('create_task'),
    description:
      '在任务大厅中创建新任务。当用户提到需要完成某件事、记录待办项、或明确要求帮忙记录任务时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '任务标题'
        },
        description: {
          type: 'string',
          description: '任务描述（可选）'
        },
        priority: {
          type: 'string',
          enum: ['urgent', 'normal', 'low'],
          description: '优先级：urgent=紧急, normal=普通, low=低'
        },
        period: {
          type: 'string',
          enum: ['short', 'long'],
          description: '周期：short=短期, long=长期'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签列表'
        },
        dueDate: {
          type: 'string',
          description: '截止日期（ISO 格式，可选）'
        },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' }
            },
            required: ['title']
          },
          description: '初始子任务列表（可选）'
        }
      },
      required: ['title']
    }
  },
  executor: {
    async execute(args) {
      try {
        const opts: Parameters<typeof taskManager.createTask>[0] = {
          title: args.title as string,
          description: args.description as string | undefined,
          priority: args.priority as 'urgent' | 'normal' | 'low' | undefined,
          period: args.period as 'short' | 'long' | undefined,
          tags: args.tags as string[] | undefined,
          dueDate: args.dueDate ? new Date(args.dueDate as string).getTime() : undefined,
          subtasks: args.subtasks as { title: string }[] | undefined
        }
        const task = taskManager.createTask(opts)
        broadcastTaskEvent({ type: 'created', task })
        return `已创建任务「${task.title}」（ID: ${task.id}，优先级: ${task.priority}，周期: ${task.period}）`
      } catch (err) {
        return `创建任务失败: ${(err as Error).message}`
      }
    }
  }
}

/** 所有本地工具定义列表 */
const LOCAL_TOOLS: LocalToolDefinition[] = [
  readFileDef,
  writeFileDef,
  listDirectoryDef,
  shellExecuteDef,
  createTaskDef
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
