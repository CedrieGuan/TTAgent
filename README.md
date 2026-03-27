# TTAgent

跨平台 AI Agent 桌面客户端，基于 Electron + React + TypeScript 构建，支持多模型提供商、流式对话、MCP 工具调用及本地会话持久化。

## 功能特性

- **多 AI 提供商**：Anthropic Claude、OpenAI GPT、智谱 AI（GLM / CodeGeeX）、Ollama 本地模型
- **流式输出**：实时逐字显示 AI 回复，支持中途取消
- **会话管理**：多会话并行，历史记录本地持久化，支持重命名与删除
- **MCP 工具集成**：通过 Model Context Protocol 连接外部工具服务器，让 Agent 具备文件操作、搜索、代码执行等能力
- **Agent 配置**：自定义系统提示词、工具开关
- **跨平台**：macOS（Apple Silicon / Intel）、Windows、Linux 一套代码

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| 构建工具 | electron-vite 2 + Vite 5 |
| 前端 | React 18 + TypeScript 5 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand 5 + Immer |
| AI SDK | `@anthropic-ai/sdk` · `openai`（兼容智谱 AI） |
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
| Anthropic | https://console.anthropic.com | claude-sonnet-4-5 |
| OpenAI | https://platform.openai.com | gpt-4o |
| 智谱 AI | https://open.bigmodel.cn | glm-4-plus |
| Ollama | 本地运行，无需 Key | 自定义 |

## 目录结构

```
TTAgent/
├── src/
│   ├── main/                    # 主进程（Node.js）
│   │   ├── index.ts            # 应用入口，生命周期管理
│   │   ├── window.ts           # BrowserWindow 工厂
│   │   ├── store.ts            # 本地持久化（electron-store）
│   │   ├── menu.ts             # 应用原生菜单
│   │   └── ipc/                # IPC Handler 集合
│   │       ├── ai.handler.ts   # AI 流式请求（Anthropic / OpenAI / 智谱）
│   │       ├── session.handler.ts  # 会话 CRUD
│   │       ├── config.handler.ts   # 配置读写
│   │       ├── mcp.handler.ts      # MCP 工具服务器管理
│   │       └── window.handler.ts   # 窗口控制
│   ├── preload/
│   │   ├── index.ts            # contextBridge：向渲染进程安全暴露 API
│   │   └── index.d.ts          # window.api 类型声明
│   ├── renderer/               # 渲染进程（React）
│   │   └── src/
│   │       ├── App.tsx         # 根组件，简单状态路由
│   │       ├── components/     # UI 组件库
│   │       │   ├── ui/         # Button、Input 等原子组件
│   │       │   ├── layout/     # Titlebar、Sidebar、MainLayout
│   │       │   └── chat/       # MessageBubble、MessageList、InputArea、ToolCallDisplay
│   │       ├── pages/          # ChatPage、SettingsPage、AgentConfigPage、HistoryPage
│   │       ├── stores/         # Zustand 状态（chat / session / settings / agent）
│   │       ├── hooks/          # useStream、useChat、useTheme
│   │       └── lib/            # 工具函数
│   └── shared/                 # 主进程与渲染进程共用
│       ├── constants/
│       │   ├── ipc.channels.ts # 所有 IPC 通道名常量
│       │   └── providers.ts    # 提供商模型列表、Base URL
│       └── types/              # TypeScript 类型定义
│           ├── ai.types.ts
│           ├── ipc.types.ts
│           ├── session.types.ts
│           └── mcp.types.ts
├── resources/                  # 应用图标（打包时使用）
├── electron.vite.config.ts
├── electron-builder.config.js
├── tsconfig.node.json          # 主进程 / 预加载 TS 配置
└── tsconfig.web.json           # 渲染进程 TS 配置
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

MCP（Model Context Protocol）允许 Agent 调用外部工具。在 **Agent 配置** 页面添加工具服务器：

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

## 支持的模型

### Anthropic
- Claude Opus 4.5 · Claude Sonnet 4.5 · Claude Haiku 3.5

### OpenAI
- GPT-4o · GPT-4o Mini · o3-mini

### 智谱 AI
- GLM-4 Plus · GLM-4 · GLM-4 Air · GLM-4 Flash（免费） · GLM-4V Plus（视觉） · CodeGeeX-4（代码）

### Ollama（本地）
- 支持任意本地部署模型，在会话设置中填写模型 ID 即可

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

### 数据持久化

使用 `electron-store` 将以下数据存储在系统用户数据目录（`app.getPath('userData')`）：

- 各提供商 API Key（仅本地，不联网传输）
- 会话列表与消息历史
- 应用设置（主题、字体、发送方式）
- MCP 服务器配置

## 开发指南

### 新增 AI 提供商

1. 在 `src/shared/types/ai.types.ts` 的 `AIProvider` 联合类型中添加新标识符
2. 在 `src/shared/constants/providers.ts` 中补充模型列表、标签、Base URL
3. 在 `src/main/ipc/ai.handler.ts` 中实现对应的 `stream*` 函数并加入路由分支
4. 在 `src/main/store.ts` 和 `src/renderer/src/stores/settings.store.ts` 中补充默认配置
5. 在 `src/renderer/src/pages/SettingsPage.tsx` 中添加 API Key 输入区

### 新增 IPC 通道

1. 在 `src/shared/constants/ipc.channels.ts` 中定义通道名常量
2. 在对应的 `src/main/ipc/*.handler.ts` 中注册 `ipcMain.handle` / `ipcMain.on`
3. 在 `src/preload/index.ts` 中通过 `contextBridge` 暴露方法
4. 在 `src/preload/index.d.ts` 中更新 `window.api` 类型声明

## License

MIT
