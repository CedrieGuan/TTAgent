# TTAgent

跨平台 AI Agent 桌面客户端，基于 Electron + React + TypeScript 构建，支持多模型提供商、流式对话、MCP 工具调用、长期记忆、技能系统及任务管理。

## 功能特性

- **多 AI 提供商**：Anthropic Claude、OpenAI GPT、智谱 AI（GLM）、Ollama 本地模型、自定义端点
- **流式输出**：实时逐字显示 AI 回复，支持中途取消
- **会话管理**：多会话并行，历史记录本地持久化，支持重命名与删除
- **Agent 循环**：多轮自动工具调用（最多 15 轮），危险操作（Shell 执行、文件写入）前弹出确认卡片（Human-in-the-loop）
- **MCP 工具集成**：通过 Model Context Protocol 连接外部工具服务器，让 Agent 具备文件操作、搜索、代码执行等能力
- **内置本地工具**：`read_file`、`write_file`、`list_directory`、`shell_execute`
- **长期记忆**：跨会话两层记忆（全局用户偏好 + 工作区项目知识），对话结束后 LLM 自动提取并持久化
- **技能系统**：基于 `SKILL.md` 文件的渐进式指令加载，通过 `/技能名` 斜杠命令触发
- **任务管理**：任务大厅，支持优先级、标签、截止日期、子任务
- **上下文管理**：接近模型上下文窗口限制时自动压缩历史消息（软阈值 75%、硬阈值 90%）
- **跨平台**：macOS（Apple Silicon / Intel）、Windows、Linux 一套代码

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| 构建工具 | electron-vite 2 + Vite 5 |
| 前端 | React 18 + TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand 5 + Immer |
| AI SDK | `@anthropic-ai/sdk` · `openai`（兼容智谱 AI / 自定义端点） |
| MCP | `@modelcontextprotocol/sdk` |
| 本地存储 | electron-store 8 |
| 打包发布 | electron-builder 25 |

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-username/TTAgent.git
cd TTAgent

# 安装依赖
npm install

# 启动开发模式（热重载）
npm run dev
```

开发模式下 Electron 窗口自动打开，渲染进程支持 HMR，主进程修改后自动重启。

### 配置 API Key

启动后进入 **设置** 页面，填入对应提供商的 API Key：

| 提供商 | 获取地址 | 默认模型 |
|---|---|---|
| Anthropic | https://console.anthropic.com | claude-sonnet-4-6 |
| OpenAI | https://platform.openai.com | gpt-4.1 |
| 智谱 AI | https://open.bigmodel.cn | glm-5.1 |
| Ollama | 本地运行，无需 Key | 自定义 |
| 自定义 | 任意兼容 OpenAI 格式的端点 | 自定义 |

## 目录结构

```
TTAgent/
├── src/
│   ├── main/                        # 主进程（Node.js）
│   │   ├── index.ts                # 应用入口，生命周期管理
│   │   ├── window.ts               # BrowserWindow 工厂
│   │   ├── store.ts                # 本地持久化（electron-store）
│   │   ├── menu.ts                 # 应用原生菜单
│   │   ├── ipc/                    # IPC Handler 集合
│   │   │   ├── ai.handler.ts       # AI 流式请求 + Agent 循环 + 工具确认
│   │   │   ├── session.handler.ts  # 会话 CRUD
│   │   │   ├── config.handler.ts   # 配置读写
│   │   │   ├── mcp.handler.ts      # MCP 工具服务器管理
│   │   │   ├── memory.handler.ts   # 长期记忆读写与工作区路径管理
│   │   │   ├── skill.handler.ts    # 技能发现、加载、目录管理
│   │   │   ├── task.handler.ts     # 任务 CRUD 与事件推送
│   │   │   ├── context.handler.ts  # 上下文压缩
│   │   │   └── window.handler.ts   # 窗口控制
│   │   ├── memory/
│   │   │   └── memory-manager.ts   # 记忆文件读写 + LLM 驱动提取
│   │   ├── tools/
│   │   │   ├── tool-router.ts      # 本地工具 + MCP 工具统一路由
│   │   │   ├── local-tools.ts      # 内置文件/Shell 工具定义
│   │   │   └── tool-schema.ts      # MCP → Anthropic/OpenAI 格式转换
│   │   └── lib/
│   │       └── skill-parser.ts     # SKILL.md frontmatter 解析
│   ├── preload/
│   │   ├── index.ts               # contextBridge：向渲染进程安全暴露 API
│   │   └── index.d.ts             # window.api 类型声明
│   ├── renderer/                   # 渲染进程（React）
│   │   └── src/
│   │       ├── App.tsx            # 根组件，路由与全局 Hook 挂载
│   │       ├── components/        # UI 组件库
│   │       │   ├── ui/            # Button、Input 等原子组件
│   │       │   ├── layout/        # Titlebar、Sidebar、MainLayout
│   │       │   ├── chat/          # MessageBubble、InputArea、ToolConfirmPill 等
│   │       │   └── dev/           # 开发日志查看器
│   │       ├── pages/             # 页面
│   │       │   ├── ChatPage.tsx
│   │       │   ├── HistoryPage.tsx
│   │       │   ├── MCPPage.tsx
│   │       │   ├── MemoryPage.tsx
│   │       │   ├── SettingsPage.tsx
│   │       │   ├── SkillsPage.tsx
│   │       │   └── TasksPage.tsx
│   │       ├── stores/            # Zustand 状态
│   │       │   ├── chat.store.ts
│   │       │   ├── session.store.ts
│   │       │   ├── settings.store.ts
│   │       │   ├── agent.store.ts
│   │       │   └── memory.store.ts
│   │       └── hooks/             # useStream、useChat、useSlashCommand 等
│   └── shared/                    # 主进程与渲染进程共用
│       ├── constants/
│       │   ├── ipc.channels.ts    # 所有 IPC 通道名常量
│       │   └── providers.ts       # 提供商模型列表、Base URL
│       └── types/
│           ├── ai.types.ts
│           ├── ipc.types.ts
│           ├── session.types.ts
│           ├── mcp.types.ts
│           ├── memory.types.ts
│           ├── skill.types.ts
│           ├── task.types.ts
│           └── context.types.ts
├── resources/                     # 应用图标（打包时使用）
├── electron.vite.config.ts
├── electron-builder.config.js
├── tsconfig.node.json             # 主进程 / 预加载 TS 配置
└── tsconfig.web.json              # 渲染进程 TS 配置
```

## 常用命令

```bash
# 开发
npm run dev           # 启动开发服务器 + Electron

# 代码质量
npm run typecheck     # TypeScript 类型检查
npm run lint          # ESLint 检查
npm run format        # Prettier 格式化

# 构建与打包
npm run build         # 仅编译，输出到 out/
npm run dist          # 编译 + 打包当前平台安装包
npm run dist:mac      # 打包 macOS DMG（x64 + arm64）
npm run dist:win      # 打包 Windows NSIS 安装包
npm run dist:linux    # 打包 Linux AppImage
```

## MCP 工具集成

MCP（Model Context Protocol）允许 Agent 调用外部工具。在 **MCP** 页面添加工具服务器：

**示例：文件系统工具**

| 字段 | 值 |
|---|---|
| 名称 | filesystem |
| 启动命令 | npx |
| 参数 | `-y @modelcontextprotocol/server-filesystem /your/path` |

**示例：Web 搜索工具**

| 字段 | 值 |
|---|---|
| 名称 | brave-search |
| 启动命令 | npx |
| 参数 | `-y @modelcontextprotocol/server-brave-search` |

连接成功后，对话时 AI 可自动调用已启用的工具，工具调用过程会以可折叠卡片形式显示在消息流中。

## 技能系统

技能以 `SKILL.md` 文件形式存放在 app userData 目录的 `skills/<技能名>/SKILL.md`。使用 YAML frontmatter 定义元数据：

```markdown
---
name: my-skill
description: 这是一个示例技能
---

技能的具体指令内容...
```

在 **技能** 页面可以浏览和管理已安装的技能。对话时输入 `/技能名` 触发斜杠命令，完整指令会即时注入当前系统提示。

## 长期记忆

两层记忆架构：

- **全局记忆**：关于用户本人的信息（偏好、习惯等），跨所有工作区共享
- **工作区记忆**：关于当前项目的信息（架构决策、代码约定等），按目录路径隔离

每次对话结束后，主进程异步触发 LLM 分析对话内容并自动提取新记忆。在 **记忆** 页面可以查看和删除已有记忆条目，并配置工作区路径。

## 支持的模型

### Anthropic
- Claude Opus 4.6 · Claude Sonnet 4.6 · Claude Haiku 4.5

### OpenAI
- GPT-4.1 · GPT-4.1 Mini · o3 · o4-mini · GPT-4o Mini

### 智谱 AI
- GLM-5.1 · GLM-4.7 · GLM-4.5 Air · GLM-4.7 Flash（免费） · GLM-4.6V（视觉）

### Ollama（本地）
- 支持任意本地部署模型，在会话设置中填写模型 ID 即可

### 自定义
- 任意兼容 OpenAI Chat Completions 格式的端点

## 架构说明

### IPC 通信安全

主进程与渲染进程严格隔离（`contextIsolation: true`，`nodeIntegration: false`），所有通信通过 `contextBridge` 暴露的 `window.api` 进行。IPC 通道名统一定义在 `src/shared/constants/ipc.channels.ts`，避免魔法字符串。

### 流式响应链路

```
AI SDK（主进程）
  → sender.send(AI_STREAM_CHUNK)
  → preload onStreamChunk 监听
  → useStream Hook（渲染进程）
  → Zustand appendStreamChunk
  → React 重渲染（流式光标）
  → stop 事件 → finalizeStream → 写入 messages[]
```

### Agent 工具确认流程

危险工具（`local_shell_execute`、`local_write_file`）执行前必须经用户确认：

```
检测到危险工具
  → requestToolConfirmation() 挂起 Promise
  → 推送 tool_confirm_request 到渲染进程
  → UI 显示 ToolConfirmPill（允许 / 始终允许 / 拒绝）
  → 用户响应 → Promise resolve → Agent 循环继续
```

### 数据持久化

- **electron-store**（`app.getPath('userData')`）：API Key、会话列表与消息历史、应用设置、MCP 服务器配置、工作区记忆路径
- **JSON 文件**（`userData/memories/`）：全局记忆 `global.json`、工作区记忆 `workspace/{base64url(path)}.json`
- **SKILL.md 文件**（`userData/skills/`）：技能指令，支持热更新

## 开发指南

### 新增 AI 提供商

1. 在 `src/shared/types/ai.types.ts` 的 `AIProvider` 联合类型中添加新标识符
2. 在 `src/shared/constants/providers.ts` 中补充模型列表、标签、Base URL
3. 在 `src/main/ipc/ai.handler.ts` 中实现对应的流函数并加入路由分支
4. 在 `src/main/store.ts` 和 `src/renderer/src/stores/settings.store.ts` 中补充默认配置
5. 在 `src/renderer/src/pages/SettingsPage.tsx` 中添加 API Key 输入区

### 新增 IPC 通道

1. 在 `src/shared/constants/ipc.channels.ts` 中定义通道名常量
2. 在对应的 `src/main/ipc/*.handler.ts` 中注册 `ipcMain.handle` / `ipcMain.on`
3. 在 `src/main/ipc/index.ts` 中注册新 handler
4. 在 `src/preload/index.ts` 中通过 `contextBridge` 暴露方法
5. 在 `src/preload/index.d.ts` 中更新 `window.api` 类型（实际上类型由 `export type API = typeof api` 自动推导，无需手动维护）

## License

MIT
