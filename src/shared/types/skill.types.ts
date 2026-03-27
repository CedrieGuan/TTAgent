/** Agent 技能定义：附加到系统提示中的专项能力 */
export interface AgentSkill {
  id: string
  name: string
  description: string
  /** 注入到系统提示的具体指令内容 */
  instructions: string
  enabled: boolean
  /** 是否为内置技能（内置技能不可删除） */
  isBuiltIn?: boolean
  createdAt: number
  updatedAt: number
}
