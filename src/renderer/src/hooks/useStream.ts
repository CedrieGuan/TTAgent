/**
 * useStream Hook
 * 监听主进程推送的流式响应事件和上下文管理事件
 * 在组件挂载时注册监听器，卸载时自动清理
 */
import { useEffect } from 'react'
import { useChatStore } from '@stores/chat.store'
import type { AIStreamChunk } from '@shared/types/ipc.types'
import type { MCPToolCall } from '@shared/types/ai.types'
import type { ContextEvent } from '@shared/types/context.types'

export function useStream(): void {
  const {
    appendStreamChunk,
    finalizeStream,
    addStreamingToolCall,
    updateStreamingToolCall,
    addMessage,
    resetStreamingState,
    addContextEvent
  } = useChatStore()

  useEffect(() => {
    // 注册流式响应事件监听
    const cleanup = window.api.onStreamChunk((chunk: AIStreamChunk) => {
      switch (chunk.type) {
        case 'text_delta':
          // 文本增量：追加到流式内容
          if (chunk.content && chunk.sessionId) {
            appendStreamChunk(chunk.sessionId, chunk.content)
          }
          break

        case 'tool_use_start':
          // 工具调用开始：添加到流式工具调用列表
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
          // 工具执行结果：更新对应工具调用的状态
          if (chunk.sessionId && chunk.toolCallId) {
            updateStreamingToolCall(chunk.sessionId, chunk.toolCallId, {
              status: chunk.toolIsError ? 'error' : 'success',
              result: chunk.toolOutput
            })
          }
          break

        case 'agent_message':
          // Agent 中间轮次消息（含工具调用）：保存到消息列表，重置流式状态准备下一轮
          if (chunk.sessionId && chunk.agentMessage) {
            addMessage(chunk.sessionId, chunk.agentMessage)
            resetStreamingState(chunk.sessionId)
          }
          break

        case 'stop':
          // 流结束：将累积内容保存为最终消息
          if (chunk.sessionId) {
            finalizeStream(chunk.sessionId)
          }
          break

        case 'error':
          // 错误：结束流并打印错误
          if (chunk.sessionId) {
            finalizeStream(chunk.sessionId)
          }
          console.error('[Stream Error]', chunk.error)
          break
      }
    })

    return cleanup
  }, [
    appendStreamChunk,
    finalizeStream,
    addStreamingToolCall,
    updateStreamingToolCall,
    addMessage,
    resetStreamingState
  ])

  useEffect(() => {
    // 注册上下文管理事件监听（用于展示 token 使用情况等信息）
    const cleanup = window.api.onContextEvent((event: ContextEvent) => {
      addContextEvent(event.sessionId, event)
    })

    return cleanup
  }, [addContextEvent])
}
