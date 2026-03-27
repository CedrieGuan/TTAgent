import { useEffect } from 'react'
import { useChatStore } from '@stores/chat.store'
import type { AIStreamChunk } from '@shared/types/ipc.types'
import type { MCPToolCall } from '@shared/types/ai.types'

export function useStream(): void {
  const { appendStreamChunk, finalizeStream, addStreamingToolCall, updateStreamingToolCall } =
    useChatStore()

  useEffect(() => {
    const cleanup = window.api.onStreamChunk((chunk: AIStreamChunk) => {
      switch (chunk.type) {
        case 'text_delta':
          if (chunk.content && chunk.sessionId) {
            appendStreamChunk(chunk.sessionId, chunk.content)
          }
          break

        case 'tool_use_start':
          if (chunk.sessionId && chunk.toolCallId && chunk.toolName) {
            const toolCall: MCPToolCall = {
              id: chunk.toolCallId,
              name: chunk.toolName,
              input: chunk.toolInput ?? {},
              status: 'running'
            }
            addStreamingToolCall(chunk.sessionId, toolCall)
          }
          break

        case 'tool_result':
          if (chunk.sessionId && chunk.toolCallId) {
            updateStreamingToolCall(chunk.sessionId, chunk.toolCallId, {
              status: chunk.toolIsError ? 'error' : 'success',
              result: chunk.toolOutput
            })
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
  }, [appendStreamChunk, finalizeStream, addStreamingToolCall, updateStreamingToolCall])
}
