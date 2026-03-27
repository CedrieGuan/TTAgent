import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { resolve, join, dirname } from 'path'
import { homedir } from 'os'
import type { MCPTool } from '@shared/types/mcp.types'

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

export function isLocalTool(toolName: string): boolean {
  return toolName.startsWith(LOCAL_TOOL_PREFIX)
}

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
        return sliced.map((line, i) => `${offset + i}: ${line}`).join('\n')
      } catch (err) {
        return `Error reading file: ${(err as Error).message}`
      }
    }
  }
}

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

const LOCAL_TOOLS: LocalToolDefinition[] = [
  readFileDef,
  writeFileDef,
  listDirectoryDef,
  shellExecuteDef
]

const executorMap = new Map(LOCAL_TOOLS.map((def) => [def.tool.name, def.executor]))

export function getLocalTools(): MCPTool[] {
  return LOCAL_TOOLS.map((def) => def.tool)
}

export function getLocalToolExecutor(toolName: string): LocalToolExecutor | undefined {
  return executorMap.get(toolName)
}

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1))
  }
  return resolve(inputPath)
}
