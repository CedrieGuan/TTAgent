/**
 * 会话管理 IPC Handler
 * 处理会话的创建、查询、更新、删除及消息持久化
 */
import { ipcMain } from 'electron'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse, CreateSessionPayload, UpdateSessionPayload } from '@shared/types/ipc.types'
import type { Session } from '@shared/types/session.types'
import type { ChatMessage } from '@shared/types/ai.types'
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@shared/constants/providers'

/** 生成唯一 ID（时间戳 + 随机字符串） */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function registerSessionHandlers(): void {
  /** 获取所有会话，按更新时间倒序排列 */
  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, (): IPCResponse<Session[]> => {
    const sessions = store.get('sessions') ?? []
    return { success: true, data: sessions.sort((a, b) => b.updatedAt - a.updatedAt) }
  })

  /** 创建新会话，使用默认提供商和模型 */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_CREATE,
    (_event, payload: CreateSessionPayload = {}): IPCResponse<Session> => {
      const sessions = store.get('sessions') ?? []
      const now = Date.now()
      const session: Session = {
        id: generateId(),
        title: payload.title ?? '新对话',
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        systemPrompt: payload.systemPrompt,
        createdAt: now,
        updatedAt: now,
        messageCount: 0
      }
      store.set('sessions', [...sessions, session])
      store.set(`messages.${session.id}`, [])
      return { success: true, data: session }
    }
  )

  /** 更新会话属性（标题、系统提示、模型、提供商） */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_UPDATE,
    (_event, payload: UpdateSessionPayload): IPCResponse<Session> => {
      const sessions = store.get('sessions') ?? []
      const idx = sessions.findIndex((s) => s.id === payload.id)
      if (idx === -1) return { success: false, error: 'Session not found' }

      const updated: Session = {
        ...sessions[idx],
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.systemPrompt !== undefined && { systemPrompt: payload.systemPrompt }),
        ...(payload.model !== undefined && { model: payload.model }),
        ...(payload.provider !== undefined && { provider: payload.provider }),
        updatedAt: Date.now()
      }
      sessions[idx] = updated
      store.set('sessions', sessions)
      return { success: true, data: updated }
    }
  )

  /** 删除会话及其所有消息 */
  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, (_event, id: string): IPCResponse => {
    const sessions = store.get('sessions') ?? []
    store.set(
      'sessions',
      sessions.filter((s) => s.id !== id)
    )
    const messages = store.get('messages') ?? {}
    delete messages[id]
    store.set('messages', messages)
    return { success: true }
  })

  /** 获取指定会话的消息列表 */
  ipcMain.handle(
    IPC_CHANNELS.SESSION_GET_MESSAGES,
    (_event, id: string): IPCResponse<ChatMessage[]> => {
      const messages = store.get(`messages.${id}` as never) ?? []
      return { success: true, data: messages as ChatMessage[] }
    }
  )

  /** 清空指定会话的所有消息，并重置消息计数 */
  ipcMain.handle(IPC_CHANNELS.SESSION_CLEAR_MESSAGES, (_event, id: string): IPCResponse => {
    store.set(`messages.${id}` as never, [] as never)
    const sessions = store.get('sessions') ?? []
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], messageCount: 0, lastMessage: undefined }
      store.set('sessions', sessions)
    }
    return { success: true }
  })
}

/**
 * 持久化单条消息到存储，并更新会话元数据
 * 供 ai.handler 在流式响应完成后调用
 */
export function persistMessage(sessionId: string, message: ChatMessage): void {
  const messages: ChatMessage[] = store.get(`messages.${sessionId}` as never) ?? []
  messages.push(message)
  store.set(`messages.${sessionId}` as never, messages as never)

  // 同步更新会话的消息计数和最后一条消息预览
  const sessions = store.get('sessions') ?? []
  const idx = sessions.findIndex((s) => s.id === sessionId)
  if (idx !== -1) {
    sessions[idx] = {
      ...sessions[idx],
      messageCount: messages.length,
      lastMessage: typeof message.content === 'string' ? message.content.slice(0, 80) : '',
      updatedAt: Date.now()
    }
    store.set('sessions', sessions)
  }
}
