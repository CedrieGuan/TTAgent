/**
 * Agent 技能 IPC Handler
 * 处理技能的增删改查和启用/禁用操作
 * 内置技能不可删除
 */
import { ipcMain } from 'electron'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { AgentSkill } from '@shared/types/skill.types'

/** 从持久化存储读取技能列表 */
function getSkills(): AgentSkill[] {
  return store.get('agentSkills') ?? []
}

/** 将技能列表写入持久化存储 */
function saveSkills(skills: AgentSkill[]): void {
  store.set('agentSkills', skills)
}

export function registerSkillHandlers(): void {
  /** 获取所有技能 */
  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, (): IPCResponse<AgentSkill[]> => {
    return { success: true, data: getSkills() }
  })

  /** 创建新技能（自动生成 id 和时间戳） */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_CREATE,
    (
      _event,
      skill: Omit<AgentSkill, 'id' | 'createdAt' | 'updatedAt'>
    ): IPCResponse<AgentSkill> => {
      const skills = getSkills()
      const newSkill: AgentSkill = {
        ...skill,
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      skills.push(newSkill)
      saveSkills(skills)
      return { success: true, data: newSkill }
    }
  )

  /** 更新技能的名称、描述或指令 */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_UPDATE,
    (
      _event,
      id: string,
      updates: Partial<Pick<AgentSkill, 'name' | 'description' | 'instructions'>>
    ): IPCResponse<AgentSkill> => {
      const skills = getSkills()
      const idx = skills.findIndex((s) => s.id === id)
      if (idx === -1) return { success: false, error: 'Skill not found' }
      skills[idx] = { ...skills[idx], ...updates, updatedAt: Date.now() }
      saveSkills(skills)
      return { success: true, data: skills[idx] }
    }
  )

  /** 删除技能（内置技能不可删除） */
  ipcMain.handle(IPC_CHANNELS.SKILL_DELETE, (_event, id: string): IPCResponse => {
    const skills = getSkills()
    const target = skills.find((s) => s.id === id)
    if (!target) return { success: false, error: 'Skill not found' }
    if (target.isBuiltIn) return { success: false, error: 'Cannot delete built-in skill' }
    saveSkills(skills.filter((s) => s.id !== id))
    return { success: true }
  })

  /** 切换技能的启用/禁用状态 */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_TOGGLE,
    (_event, id: string, enabled: boolean): IPCResponse<AgentSkill> => {
      const skills = getSkills()
      const idx = skills.findIndex((s) => s.id === id)
      if (idx === -1) return { success: false, error: 'Skill not found' }
      skills[idx] = { ...skills[idx], enabled, updatedAt: Date.now() }
      saveSkills(skills)
      return { success: true, data: skills[idx] }
    }
  )
}
