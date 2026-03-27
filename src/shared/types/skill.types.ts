export interface AgentSkill {
  id: string
  name: string
  description: string
  instructions: string
  enabled: boolean
  isBuiltIn?: boolean
  createdAt: number
  updatedAt: number
}
