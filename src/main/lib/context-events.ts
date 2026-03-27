/**
 * 上下文事件工具函数
 * 负责将上下文管理事件通过 IPC 推送到渲染进程
 */
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { ContextEvent } from '@shared/types/context.types'

type Sender = Electron.WebContents

/**
 * 向渲染进程发送上下文事件
 * 发送前检查 WebContents 是否已销毁，避免向已关闭的窗口发送消息
 */
export function emitContextEvent(sender: Sender, event: ContextEvent): void {
  if (!sender.isDestroyed()) {
    sender.send(IPC_CHANNELS.CONTEXT_EVENT, event)
  }
}

/** 创建一个上下文事件对象（自动填充 timestamp） */
export function createEvent(
  type: ContextEvent['type'],
  sessionId: string,
  message: string,
  data?: ContextEvent['data']
): ContextEvent {
  return { type, sessionId, timestamp: Date.now(), message, data }
}
