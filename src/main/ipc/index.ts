/**
 * IPC Handler 注册入口
 * 统一注册所有主进程 IPC 处理器
 */
import { registerAIHandlers } from './ai.handler'
import { registerSessionHandlers } from './session.handler'
import { registerConfigHandlers } from './config.handler'
import { registerMCPHandlers } from './mcp.handler'
import { registerWindowHandlers } from './window.handler'
import { registerSkillHandlers } from './skill.handler'
import { registerContextHandlers } from './context.handler'
import { registerMemoryHandlers } from './memory.handler'
import { registerTaskHandlers } from './task.handler'

export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerSessionHandlers()
  registerAIHandlers()
  registerMCPHandlers()
  registerWindowHandlers()
  registerSkillHandlers()
  registerContextHandlers()
  registerMemoryHandlers()
  registerTaskHandlers()
}
