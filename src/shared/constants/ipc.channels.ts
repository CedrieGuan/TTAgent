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

  // 配置
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

  // Context Strategy
  CONTEXT_EVENT: 'context:event',
  CONTEXT_COMPRESS: 'context:compress',

  // Agent Skills
  SKILL_LIST: 'skill:list',
  SKILL_CREATE: 'skill:create',
  SKILL_UPDATE: 'skill:update',
  SKILL_DELETE: 'skill:delete',
  SKILL_TOGGLE: 'skill:toggle',

  // 系统 / 窗口
  APP_VERSION: 'app:version',
  APP_CHECK_UPDATE: 'app:check-update',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized'
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
