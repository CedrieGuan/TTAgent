import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { ContextEvent } from '@shared/types/context.types'

type Sender = Electron.WebContents

export function emitContextEvent(sender: Sender, event: ContextEvent): void {
  if (!sender.isDestroyed()) {
    sender.send(IPC_CHANNELS.CONTEXT_EVENT, event)
  }
}

export function createEvent(
  type: ContextEvent['type'],
  sessionId: string,
  message: string,
  data?: ContextEvent['data']
): ContextEvent {
  return { type, sessionId, timestamp: Date.now(), message, data }
}
