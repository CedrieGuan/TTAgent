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

| 进程 | 入口 | 职责 |
|------|------|------|
| Main | `src/main/index.ts` | AI 流式调用、数据持久化、MCP 客户端 |
| Preload | `src/preload/index.ts` | 通过 `contextBridge` 将 IPC 封装为 `window.api` |
| Renderer | `src/renderer/src/main.tsx` | React UI，通过 `window.api` 与主进程通信 |

共享代码在 `src/shared/`，三个进程均可引用，别名为 `@shared`。

### IPC 通信模式

所有 IPC 频道定义在 `src/shared/constants/ipc.channels.ts`。渲染进程调用 `window.api`（在 `src/preload/index.ts` 中定义类型），主进程在 `src/main/ipc/` 下各文件中注册 handler：

- `ai.handler.ts` — AI 流式对话（`ipcMain.handle` + `sender.send` 推送流块）
- `session.handler.ts` — 会话 CRUD 及消息持久化
- `config.handler.ts` — 读写 electron-store 配置
- `mcp.handler.ts` — MCP 服务器连接与工具调用

**流式传输**：AI 回复不通过 `invoke` 返回值传递，而是主进程用 `sender.send(AI_STREAM_CHUNK, chunk)` 主动推送，渲染进程通过 `useStream` hook（挂在 App 根）全局监听并写入 Zustand store。

### 渲染进程状态管理

使用 **Zustand + Immer**，stores 在 `src/renderer/src/stores/`：

- `chat.store.ts` — 消息列表、`isThinking`（等待第一个流块）、`isStreaming`（流传输中）、流内容缓冲
- `session.store.ts` — 会话列表与当前选中会话
- `settings.store.ts` — API 密钥、主题、发送方式等设置
- `agent.store.ts` — MCP 工具列表与启用状态

状态流：`useChat` hook → 调用 `window.api.sendMessage` → 主进程推流 → `useStream` 监听 → `chat.store` 更新。

### 数据持久化

主进程使用 `electron-store`（`src/main/store.ts`）存储所有数据，schema 包含：`providers`、`settings`、`mcpServers`、`sessions`、`messages`（按 sessionId 分 key：`messages.${sessionId}`）、`agentSystemPrompt`。

### 多 AI 提供商

`src/main/ipc/ai.handler.ts` 中对三个提供商分别实现流函数：
- **Anthropic**：`@anthropic-ai/sdk` 的 `messages.stream()`
- **OpenAI**：`openai` SDK，`stream: true`
- **智谱 AI**：复用 OpenAI SDK，`baseURL` 改为智谱兼容端点

模型列表和提供商标签定义在 `src/shared/constants/providers.ts`，新增提供商需同时更新此文件和 `ai.handler.ts`。

### 路径别名

| 别名 | 路径（渲染进程） |
|------|------|
| `@shared` | `src/shared` |
| `@components` | `src/renderer/src/components` |
| `@stores` | `src/renderer/src/stores` |
| `@hooks` | `src/renderer/src/hooks` |
| `@lib` | `src/renderer/src/lib` |
| `@pages` | `src/renderer/src/pages` |

主进程别名：`@shared` → `src/shared`，`@main` → `src/main`。

### 类型定义位置

- AI 相关（`ChatMessage`、`Attachment`、`AIProvider`、`ModelInfo`）→ `src/shared/types/ai.types.ts`
- IPC 载荷（`AIRequestPayload`、`AIStreamChunk`、`UpdateSessionPayload`）→ `src/shared/types/ipc.types.ts`
- 会话结构 → `src/shared/types/session.types.ts`
- MCP 相关 → `src/shared/types/mcp.types.ts`

### 注意事项

- `typecheck` 对主进程和渲染进程分别执行（`tsconfig.node.json` / `tsconfig.web.json`），两者模块解析配置不同，`@tailwindcss/vite` 会产生一个已知的无害警告。
- `electron-store` 只在主进程可用，渲染进程通过 `window.api` 的 config 方法间接读写。
- 取消流通过 `AbortController`（存于 `activeStreams` Map）实现，`AI_CANCEL_STREAM` 是 `ipcMain.on`（非 handle），渲染进程用 `ipcRenderer.send`。
