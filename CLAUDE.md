# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # 启动开发模式（electron-vite dev）
npm run build        # 构建生产包
npm run typecheck    # TypeScript 类型检查（主进程 + 渲染进程各自独立）
npm run lint         # ESLint 检查
npm run format       # Prettier 格式化 src/**
npm run dist         # 构建 + 打包安装包
npm run dist:mac     # 仅 macOS
```

无单元测试框架，验证方式为 `npm run typecheck` + 手动运行 `npm run dev`。

## 架构概览

这是一个基于 **electron-vite** 的 Electron + React + TypeScript 桌面应用，由三个独立编译上下文组成：

### 进程划分

| 进程     | 入口                        | 职责                                            |
| -------- | --------------------------- | ----------------------------------------------- |
| Main     | `src/main/index.ts`         | AI 流式调用、数据持久化、MCP 客户端             |
| Preload  | `src/preload/index.ts`      | 通过 `contextBridge` 将 IPC 封装为 `window.api` |
| Renderer | `src/renderer/src/main.tsx` | React UI，通过 `window.api` 与主进程通信        |

共享代码在 `src/shared/`，三个进程均可引用，别名为 `@shared`。

### IPC 通信模式

所有 IPC 频道定义在 `src/shared/constants/ipc.channels.ts`。渲染进程调用 `window.api`（在 `src/preload/index.ts` 中定义类型），主进程在 `src/main/ipc/` 下各文件中注册 handler：

- `ai.handler.ts` — AI 流式对话（`ipcMain.handle` + `sender.send` 推送流块）
- `session.handler.ts` — 会话 CRUD 及消息持久化
- `config.handler.ts` — 读写 electron-store 配置
- `mcp.handler.ts` — MCP 服务器连接与工具调用
- `memory.handler.ts` — 长期记忆读取、删除、清空与工作区路径管理

**流式传输**：AI 回复不通过 `invoke` 返回值传递，而是主进程用 `sender.send(AI_STREAM_CHUNK, chunk)` 主动推送，渲染进程通过 `useStream` hook（挂在 App 根）全局监听并写入 Zustand store。

### 渲染进程状态管理

使用 **Zustand + Immer**，stores 在 `src/renderer/src/stores/`：

- `chat.store.ts` — 消息列表、`isThinking`（等待第一个流块）、`isStreaming`（流传输中）、流内容缓冲、`pendingConfirmsBySession`（按会话分组的待确认工具请求）
- `session.store.ts` — 会话列表与当前选中会话
- `settings.store.ts` — API 密钥、主题、发送方式等设置
- `agent.store.ts` — MCP 工具列表与启用状态
- `memory.store.ts` — 全局/工作区记忆列表、工作区路径、记忆事件，提供 `getMemoryPrompt()` 注入系统提示

状态流：`useChat` hook → 调用 `window.api.sendMessage` → 主进程推流 → `useStream` 监听 → `chat.store` 更新。

### 数据持久化

主进程使用 `electron-store`（`src/main/store.ts`）存储所有数据，schema 包含：`providers`、`settings`、`mcpServers`、`sessions`、`messages`（按 sessionId 分 key：`messages.${sessionId}`）、`agentSystemPrompt`、`memoryWorkspacePath`（工作区记忆路径，空字符串表示未设置）。

记忆数据以 JSON 文件形式独立存储在 userData 目录的 `memories/` 下，不经过 electron-store：全局记忆 `memories/global.json`、工作区记忆 `memories/workspace/{base64url(path)}.json`。

### 多 AI 提供商

`src/main/ipc/ai.handler.ts` 中对三个提供商分别实现流函数：

- **Anthropic**：`@anthropic-ai/sdk` 的 `messages.stream()`
- **OpenAI**：`openai` SDK，`stream: true`
- **智谱 AI**：复用 OpenAI SDK，`baseURL` 改为智谱兼容端点

模型列表和提供商标签定义在 `src/shared/constants/providers.ts`，新增提供商需同时更新此文件和 `ai.handler.ts`。

### Agent 循环与工具调用

AI handler 实现了多轮工具调用循环（最多 `MAX_AGENT_ITERATIONS = 15` 次）：

1. 发送消息 → LLM 返回文本 + 可选工具调用
2. 若有工具调用：**危险工具先请求用户确认**（见下方"安全防护"）→ 执行工具 → 将结果作为 `user`（Anthropic）或 `tool`（OpenAI）消息追加 → 再次调用 LLM
3. 无工具调用时循环结束，最终 assistant 消息持久化

工具来源合并自**本地内置工具**和 **MCP 工具**，由 `ToolRouter`（`src/main/tools/tool-router.ts`）路由：

- 本地工具名以 `local_` 为前缀（定义于 `src/main/tools/local-tools.ts`）：`local_read_file`、`local_write_file`、`local_list_directory`、`local_shell_execute`
- MCP 工具通过已连接的 MCP 客户端轮询执行

工具 schema 转换（MCP → Anthropic/OpenAI 格式）在 `src/main/tools/tool-schema.ts`。

### 安全防护（Human-in-the-loop）

危险工具（`local_shell_execute`、`local_write_file`）在执行前必须经用户确认，防止 Agent 自动执行破坏性操作。

**流程**：
1. `executeToolCalls` 检测到危险工具 → 调用 `requestToolConfirmation()`
2. 主进程向渲染进程推送 `tool_confirm_request` 流块（包含 `confirmId`、`toolName`、`toolInput`）并 await 一个 Promise
3. 渲染进程 `useStream` 将请求加入 `chat.store` 的 `pendingConfirmsBySession`，UI 显示 `ToolConfirmPill` 确认卡片
4. 用户点击三选一：
   - **允许**：一次性放行
   - **始终允许**：将工具名加入 `sessionAlwaysAllowed`，本会话内不再询问
   - **拒绝**：工具收到 `[用户已拒绝此操作]` 错误结果，Agent 继续循环告知用户
5. 渲染进程调用 `window.api.sendToolConfirmResponse({ confirmId, response })`，主进程 Promise resolve，循环继续

**取消时防死锁**：AbortSignal 触发时 `requestToolConfirmation` 自动 resolve('reject')，不会永久挂起。流结束（`stop`/`error`）时渲染进程调用 `clearPendingConfirms` 清空残留确认卡片。

**关键数据结构**（均在 `ai.handler.ts` 模块级）：
- `DANGEROUS_TOOLS: Set<string>` — 需要确认的工具集合
- `pendingConfirms: Map<confirmId, resolve>` — 待响应的 Promise 回调
- `sessionAlwaysAllowed: Map<sessionId, Set<toolName>>` — 会话级始终允许表（内存，不持久化）

### 长期记忆（Memory）系统

两层记忆架构，跨会话保持上下文连贯性：

- **全局记忆**（Global）：关于用户本人的信息（偏好、背景、习惯等），写入 `memories/global.json`
- **工作区记忆**（Workspace）：关于当前项目的信息（架构决策、代码约定等），写入 `memories/workspace/{base64url(path)}.json`

核心模块 `src/main/memory/memory-manager.ts`（`MemoryManager` 类，以全局单例导出）负责：
1. 文件读写（`getGlobalMemories`、`getWorkspaceMemories`、`saveXxxMemories` 等）
2. **LLM 驱动的记忆提取**：对话结束后在 `ai.handler.ts` 的 `finally` 块中异步触发（fire-and-forget），调用同一提供商/模型分析对话内容，返回 `{ global: string[], workspace: string[] }` 并追加到对应文件
3. 构建记忆注入片段（`buildMemoryPrompt`）供系统提示使用

**注入策略**：`useChat.ts` 的 `buildSystemPrompt` 将记忆作为第二层注入（顺序：基础提示 → 记忆 → 技能概览 → 激活技能指令）。

**事件流**：主进程通过 `MEMORY_EVENT` 频道推送 `memory_extraction_started / completed / failed` 事件 → `useStream` 监听 → `memory.store` 更新 → `MemoryEventPill` 在对话中展示（仅显示完成/失败，过滤"开始"事件）。

工作区路径存储在 electron-store 的 `memoryWorkspacePath` 字段，通过 `MEMORY_GET_WORKSPACE_PATH` / `MEMORY_SET_WORKSPACE_PATH` IPC 读写。

类型定义在 `src/shared/types/memory.types.ts`（`Memory`、`MemoryEvent`、`MemoryScope`、`MemoryExtractionResult`）。

### 技能（Skill）系统

技能基于文件系统的 SKILL.md 文件，采用类 Claude Code 的渐进式加载架构：

- 技能以 `SKILL.md` 文件存放在 app userData 目录的 `skills/<技能名>/SKILL.md`
- SKILL.md 使用 YAML frontmatter 定义元数据（name、description、disable-model-invocation），markdown 正文为具体指令
- 发现：`src/main/lib/skill-parser.ts` 扫描技能目录，解析 frontmatter（使用 `gray-matter` 库）
- IPC：`skill.handler.ts` 提供 `SKILL_DISCOVER`（扫描摘要）、`SKILL_LOAD`（加载完整指令）、`SKILL_OPEN_DIR`（打开目录）
- 注入策略：初始只将技能名称和描述注入系统提示概览；用户在聊天中输入 `/技能名` 时才加载并注入完整指令
- 渲染进程通过 `useSlashCommand` hook 提供斜杠命令检测和候选补全
- 类型定义在 `src/shared/types/skill.types.ts`（`Skill`、`SkillSummary`、`SkillMeta`）

### 上下文管理

`src/shared/types/context.types.ts` 定义了上下文长度管理的数据结构（`TokenBudget`、`ConversationTurn`、`ContextStrategyConfig`、`ContextEvent`），用于在接近模型上下文窗口限制时自动截断或摘要历史消息。默认配置：软阈值 75%、硬阈值 90%、单条消息 offload 阈值 8000 tokens。

### 路径别名

| 别名          | 路径（渲染进程）              |
| ------------- | ----------------------------- |
| `@shared`     | `src/shared`                  |
| `@components` | `src/renderer/src/components` |
| `@stores`     | `src/renderer/src/stores`     |
| `@hooks`      | `src/renderer/src/hooks`      |
| `@lib`        | `src/renderer/src/lib`        |
| `@pages`      | `src/renderer/src/pages`      |

主进程别名：`@shared` → `src/shared`，`@main` → `src/main`。

### 类型定义位置

- AI 相关（`ChatMessage`、`Attachment`、`AIProvider`、`ModelInfo`）→ `src/shared/types/ai.types.ts`
- IPC 载荷（`AIRequestPayload`、`AIStreamChunk`、`UpdateSessionPayload`）→ `src/shared/types/ipc.types.ts`
- 会话结构 → `src/shared/types/session.types.ts`
- MCP 相关 → `src/shared/types/mcp.types.ts`
- 技能（`Skill`、`SkillSummary`、`SkillMeta`）→ `src/shared/types/skill.types.ts`
- 上下文管理（`TokenBudget`、`ContextStrategyConfig`、`ContextEvent`）→ `src/shared/types/context.types.ts`
- 长期记忆（`Memory`、`MemoryEvent`、`MemoryScope`、`MemoryExtractionResult`）→ `src/shared/types/memory.types.ts`

### 注意事项

- `typecheck` 对主进程和渲染进程分别执行（`tsconfig.node.json` / `tsconfig.web.json`），两者模块解析配置不同，`@tailwindcss/vite` 会产生一个已知的无害警告。
- `electron-store` 只在主进程可用，渲染进程通过 `window.api` 的 config 方法间接读写。
- 取消流通过 `AbortController`（存于 `activeStreams` Map）实现，`AI_CANCEL_STREAM` 是 `ipcMain.on`（非 handle），渲染进程用 `ipcRenderer.send`。工具确认响应同理：`AI_TOOL_CONFIRM_RESPONSE` 也是 `ipcMain.on`，渲染进程用 `ipcRenderer.send`。
- **注释规范**：生成功能代码（主进程逻辑、IPC handler、工具函数、类型定义、hooks、stores 等）时必须添加中文注释，说明函数/方法/关键逻辑的用途；UI 组件（`src/renderer/src/components/`、`src/renderer/src/pages/` 中的 JSX/样式）不需要添加注释。
