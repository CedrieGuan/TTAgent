/**
 * 计划（Plans）类型定义
 * Markdown 文件管理的核心数据结构
 */

/** 计划元数据（不含文件内容） */
export interface Plan {
  /** 文件名不含扩展名，作为唯一 ID */
  id: string
  /** 显示名称（同 id） */
  title: string
  /** 文件绝对路径 */
  filePath: string
  updatedAt: number
  createdAt: number
  /** 文件大小（字节） */
  size: number
}

/** 计划完整数据（含文件内容） */
export interface PlanWithContent extends Plan {
  content: string
}

/** 计划分组 */
export interface PlanGroup {
  id: string
  name: string
  collapsed: boolean
  order: number
}

/** 分组持久化数据（存储在 groups.json） */
export interface PlanGroupData {
  groups: PlanGroup[]
  /** planId → groupId，无条目表示未分组 */
  assignments: Record<string, string>
}
