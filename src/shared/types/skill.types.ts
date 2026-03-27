/** SKILL.md 文件的 YAML frontmatter 元数据 */
export interface SkillMeta {
  /** 技能名称（kebab-case，来自 frontmatter 或目录名） */
  name: string
  /** 描述：AI 根据此判断是否自动调用该技能 */
  description: string
  /** 是否禁止 AI 自动调用（为 true 时仅支持用户 /命令触发） */
  disableModelInvocation?: boolean
}

/** 解析后的完整技能数据（包含 SKILL.md 正文指令） */
export interface Skill {
  /** 技能 ID（取自目录名） */
  id: string
  /** 元数据（来自 YAML frontmatter） */
  meta: SkillMeta
  /** SKILL.md 的完整 markdown 正文（指令内容） */
  instructions: string
  /** SKILL.md 文件的绝对路径 */
  filePath: string
  /** 技能目录的绝对路径 */
  dirPath: string
  /** 辅助文件列表（相对路径） */
  supportingFiles: string[]
}

/** 渲染进程使用的技能摘要（仅元数据，用于初始加载和系统提示概览） */
export interface SkillSummary {
  id: string
  name: string
  description: string
  disableModelInvocation: boolean
  filePath: string
}
