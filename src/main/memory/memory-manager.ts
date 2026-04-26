/**
 * 记忆管理器
 * 负责长期记忆的文件持久化、LLM 驱动的记忆提取，以及系统提示注入
 *
 * 两层记忆架构：
 * - 全局记忆（global）：跨会话，存储用户偏好、背景信息等
 * - 工作区记忆（workspace）：项目级，存储代码约定、技术决策等
 */
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { store } from '../store'
import { PROVIDER_MAP } from '@shared/constants/providers'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { logger } from '../logger'
import type {
  Memory,
  MemoryFile,
  MemoryExtractionResult,
  MemoryEvent
} from '@shared/types/memory.types'
import type { ChatMessage, AIProvider } from '@shared/types/ai.types'

export class MemoryManager {
  private memoriesDir: string
  private globalMemoryPath: string
  private workspaceMemoriesDir: string

  constructor() {
    this.memoriesDir = path.join(app.getPath('userData'), 'memories')
    this.globalMemoryPath = path.join(this.memoriesDir, 'global.json')
    this.workspaceMemoriesDir = path.join(this.memoriesDir, 'workspace')
    this.ensureDirs()
  }

  /** 确保记忆目录存在 */
  private ensureDirs(): void {
    fs.mkdirSync(this.memoriesDir, { recursive: true })
    fs.mkdirSync(this.workspaceMemoriesDir, { recursive: true })
  }

  /** 根据工作区路径生成对应的记忆文件路径（base64url 编码防止特殊字符） */
  private getWorkspaceMemoryPath(workspacePath: string): string {
    const encoded = Buffer.from(workspacePath).toString('base64url')
    return path.join(this.workspaceMemoriesDir, `${encoded}.json`)
  }

  /** 读取指定路径的记忆文件，文件不存在时返回空数组 */
  private readMemoryFile(filePath: string): Memory[] {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      const file: MemoryFile = JSON.parse(data)
      return Array.isArray(file.memories) ? file.memories : []
    } catch {
      return []
    }
  }

  /** 将记忆列表写入指定路径的文件 */
  private writeMemoryFile(filePath: string, memories: Memory[]): void {
    const file: MemoryFile = { memories, lastUpdated: Date.now() }
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8')
  }

  /** 获取全局记忆列表 */
  getGlobalMemories(): Memory[] {
    return this.readMemoryFile(this.globalMemoryPath)
  }

  /** 获取指定工作区的记忆列表 */
  getWorkspaceMemories(workspacePath: string): Memory[] {
    return this.readMemoryFile(this.getWorkspaceMemoryPath(workspacePath))
  }

  /** 保存全局记忆列表（完整覆盖） */
  saveGlobalMemories(memories: Memory[]): void {
    this.writeMemoryFile(this.globalMemoryPath, memories)
  }

  /** 保存工作区记忆列表（完整覆盖） */
  saveWorkspaceMemories(workspacePath: string, memories: Memory[]): void {
    this.writeMemoryFile(this.getWorkspaceMemoryPath(workspacePath), memories)
  }

  /** 删除指定全局记忆条目 */
  deleteGlobalMemory(id: string): void {
    const memories = this.getGlobalMemories().filter((m) => m.id !== id)
    this.saveGlobalMemories(memories)
  }

  /** 删除指定工作区记忆条目 */
  deleteWorkspaceMemory(workspacePath: string, id: string): void {
    const memories = this.getWorkspaceMemories(workspacePath).filter((m) => m.id !== id)
    this.saveWorkspaceMemories(workspacePath, memories)
  }

  /** 清空全局记忆 */
  clearGlobalMemories(): void {
    this.saveGlobalMemories([])
  }

  /** 清空工作区记忆 */
  clearWorkspaceMemories(workspacePath: string): void {
    this.saveWorkspaceMemories(workspacePath, [])
  }

  /**
   * 构建记忆注入的系统提示片段
   * @param workspacePath 可选的工作区路径；若提供则同时注入工作区记忆
   * @returns 格式化的记忆提示字符串，无记忆时返回空字符串
   */
  buildMemoryPrompt(workspacePath?: string): string {
    const globalMemories = this.getGlobalMemories()
    const workspaceMemories = workspacePath ? this.getWorkspaceMemories(workspacePath) : []

    if (globalMemories.length === 0 && workspaceMemories.length === 0) {
      return ''
    }

    let prompt = '\n\n# Long-term Memory\n'

    if (globalMemories.length > 0) {
      prompt += '\n## About the User\n'
      for (const m of globalMemories) {
        prompt += `- ${m.content}\n`
      }
    }

    if (workspaceMemories.length > 0) {
      const wsLabel = workspacePath ? path.basename(workspacePath) : 'workspace'
      prompt += `\n## Workspace: ${wsLabel}\n`
      for (const m of workspaceMemories) {
        prompt += `- ${m.content}\n`
      }
    }

    return prompt
  }

  /**
   * 异步触发 LLM 记忆提取
   * 分析本次对话内容，将值得记忆的信息持久化
   * 该方法不阻塞主对话流程，调用方 fire-and-forget 即可
   */
  async extractAndUpdateMemories(opts: {
    sessionId: string
    messages: ChatMessage[]
    provider: string
    model: string
    workspacePath?: string
    sender?: Electron.WebContents
  }): Promise<void> {
    const { sessionId, messages, provider, model, workspacePath, sender } = opts

    // 仅保留有实质内容的对话轮次（过滤工具消息和空内容）
    const conversationMessages = messages.filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        m.content &&
        typeof m.content === 'string' &&
        m.content.length > 0
    )

    // 对话轮次过少，无需提取
    if (conversationMessages.length < 2) return

    const emitEvent = (event: MemoryEvent): void => {
      if (sender && !sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.MEMORY_EVENT, event)
      }
    }

    emitEvent({
      type: 'memory_extraction_started',
      sessionId,
      timestamp: Date.now(),
      message: '正在从对话中提取记忆...'
    })

    try {
      const existingGlobal = this.getGlobalMemories()
      const existingWorkspace = workspacePath ? this.getWorkspaceMemories(workspacePath) : []

      const result = await this.callLLMForExtraction({
        provider,
        model,
        messages: conversationMessages,
        existingGlobal,
        existingWorkspace,
        hasWorkspace: !!workspacePath
      })

      let totalAdded = 0
      const now = Date.now()

      if (result.global.length > 0) {
        const newMemories: Memory[] = result.global.map((content) => ({
          id: randomUUID(),
          content,
          createdAt: now,
          updatedAt: now,
          sessionId
        }))
        this.saveGlobalMemories([...existingGlobal, ...newMemories])
        totalAdded += newMemories.length
      }

      if (workspacePath && result.workspace.length > 0) {
        const newMemories: Memory[] = result.workspace.map((content) => ({
          id: randomUUID(),
          content,
          createdAt: now,
          updatedAt: now,
          sessionId
        }))
        this.saveWorkspaceMemories(workspacePath, [...existingWorkspace, ...newMemories])
        totalAdded += newMemories.length
      }

      emitEvent({
        type: 'memory_extraction_completed',
        sessionId,
        timestamp: Date.now(),
        message: totalAdded > 0 ? `记忆已更新（新增 ${totalAdded} 条）` : '无新记忆',
        addedCount: totalAdded
      })
    } catch (err) {
      logger.memory.error('记忆提取失败:', err)
      emitEvent({
        type: 'memory_extraction_failed',
        sessionId,
        timestamp: Date.now(),
        message: '记忆提取失败'
      })
    }
  }

  /** 调用 LLM 分析对话并提取值得记忆的信息 */
  private async callLLMForExtraction(opts: {
    provider: string
    model: string
    messages: ChatMessage[]
    existingGlobal: Memory[]
    existingWorkspace: Memory[]
    hasWorkspace: boolean
  }): Promise<MemoryExtractionResult> {
    const { provider, model, messages, existingGlobal, existingWorkspace, hasWorkspace } = opts

    const conversationText = messages
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n')

    const existingGlobalText =
      existingGlobal.length > 0
        ? existingGlobal.map((m) => `- ${m.content}`).join('\n')
        : '（暂无）'

    const existingWorkspaceText =
      existingWorkspace.length > 0
        ? existingWorkspace.map((m) => `- ${m.content}`).join('\n')
        : '（暂无）'

    const systemPrompt = `你是一个智能记忆提取系统。请分析以下对话，提取需要长期记住的重要信息。

【提取规则】
1. 全局记忆：关于用户本人的信息——技术偏好、编程风格、背景经验、惯用工具、个人习惯等
2. 工作区记忆：关于当前项目的信息——架构决策、代码约定、进行中的任务、重要发现、已知问题等
3. 每条记忆须简洁（1-2句），具体且有实际价值
4. 不要重复已有记忆中的内容
5. 对话性寒暄、临时性内容不需要记忆
6. 若无新内容可提取，返回空数组

【已有全局记忆】
${existingGlobalText}

【已有工作区记忆】
${existingWorkspaceText}

请以 JSON 格式返回需要新增的记忆（仅返回 JSON，不含其他文字）：
{
  "global": ["新全局记忆1", "新全局记忆2"],
  "workspace": ${hasWorkspace ? '["新工作区记忆1"]' : '[]'}
}`

    const userMessage = `请分析以下对话并提取值得记忆的信息：\n\n${conversationText}`

    const providers = store.get('providers') ?? {}

    if (provider === 'anthropic') {
      const config = providers['anthropic']
      if (!config?.apiKey) throw new Error('Anthropic API Key 未配置')
      const client = new Anthropic({ apiKey: config.apiKey })
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
      const text = response.content.find((b) => b.type === 'text')?.text ?? '{}'
      return this.parseExtractionResult(text)
    }

    // 所有 OpenAI 兼容提供商统一处理
    const config = providers[provider] as { apiKey?: string; baseUrl?: string; defaultModel: string } | undefined
    if (!config?.apiKey) throw new Error(`${provider} API Key 未配置`)
    const providerDef = PROVIDER_MAP.get(provider as AIProvider)
    const baseURL = config.baseUrl || providerDef?.defaultBaseUrl
    if (!baseURL) throw new Error(`${provider} Base URL 未配置`)

    const client = new OpenAI({ apiKey: config.apiKey, baseURL })
    const response = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
    const text = response.choices[0]?.message?.content ?? '{}'
    return this.parseExtractionResult(text)
  }

  /** 解析 LLM 返回的 JSON，容错处理非标准输出 */
  private parseExtractionResult(text: string): MemoryExtractionResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : text
      const parsed = JSON.parse(jsonStr)
      return {
        global: Array.isArray(parsed.global)
          ? parsed.global.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
          : [],
        workspace: Array.isArray(parsed.workspace)
          ? parsed.workspace.filter(
              (s: unknown): s is string => typeof s === 'string' && s.length > 0
            )
          : []
      }
    } catch {
      return { global: [], workspace: [] }
    }
  }
}

/** 全局单例，所有模块共享同一个 MemoryManager 实例 */
export const memoryManager = new MemoryManager()
