import { registerAIHandlers } from './ai.handler'
import { registerSessionHandlers } from './session.handler'
import { registerConfigHandlers } from './config.handler'
import { registerMCPHandlers } from './mcp.handler'
import { registerWindowHandlers } from './window.handler'

export function registerAllHandlers(): void {
  registerConfigHandlers()
  registerSessionHandlers()
  registerAIHandlers()
  registerMCPHandlers()
  registerWindowHandlers()
}
