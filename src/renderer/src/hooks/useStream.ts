import { useEffect } from 'react'
import { useChatStore } from '@stores/chat.store'
import type { AIStreamChunk } from '@shared/types/ipc.types'

/**
 * 全局注册流式事件监听器。
 * 只在 App 根组件挂载一次，组件卸载时自动清理。
 */
export function useStream(): void {
  const { appendStreamChunk, finalizeStream } = useChatStore()

  useEffect(() => {
    const cleanup = window.api.onStreamChunk((chunk: AIStreamChunk) => {
      switch (chunk.type) {
        case 'text_delta':
          if (chunk.content && chunk.sessionId) {
            appendStreamChunk(chunk.sessionId, chunk.content)
          }
          break
        case 'stop':
          if (chunk.sessionId) {
            finalizeStream(chunk.sessionId)
          }
          break
        case 'error':
          if (chunk.sessionId) {
            finalizeStream(chunk.sessionId)
          }
          console.error('[Stream Error]', chunk.error)
          break
      }
    })

    return cleanup
  }, [appendStreamChunk, finalizeStream])
}
