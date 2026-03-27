/**
 * IPC 通信频道常量
 * 主进程与渲染进程之间所有通信频道的统一定义
 */
export const IPC_CHANNELS = {
  // AI 对话
  AI_SEND_MESSAGE: 'ai:send-message',
  AI_STREAM_CHUNK: 'ai:stream-chunk',
  AI_CANCEL_STREAM: 'ai:cancel-stream',

  // 会话管理
  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  SESSION_UPDATE: 'session:update',
  SESSION_GET_MESSAGES: 'session:get-messages',
  SESSION_CLEAR_MESSAGES: 'session:clear-messages',

  // 配置读写
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:get-all',
  CONFIG_DELETE: 'config:delete',

  // MCP 工具
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',
  MCP_CONNECT_SERVER: 'mcp:connect-server',
  MCP_DISCONNECT_SERVER: 'mcp:disconnect-server',
  MCP_LIST_SERVERS: 'mcp:list-servers',

  // 上下文管理
  CONTEXT_EVENT: 'context:event',
  CONTEXT_COMPRESS: 'context:compress',

  // 文件技能（基于 SKILL.md）
  SKILL_DISCOVER: 'skill:discover',
  SKILL_LOAD: 'skill:load',
  SKILL_OPEN_DIR: 'skill:open-dir',

  // 系统 / 窗口
  APP_VERSION: 'app:version',
  APP_CHECK_UPDATE: 'app:check-update',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized'
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
