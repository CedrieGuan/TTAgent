import { ipcMain } from 'electron'
import { store } from '../store'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { AgentSkill } from '@shared/types/skill.types'

function getSkills(): AgentSkill[] {
  return store.get('agentSkills') ?? []
}

function saveSkills(skills: AgentSkill[]): void {
  store.set('agentSkills', skills)
}

export function registerSkillHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, (): IPCResponse<AgentSkill[]> => {
    return { success: true, data: getSkills() }
  })

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

  ipcMain.handle(IPC_CHANNELS.SKILL_DELETE, (_event, id: string): IPCResponse => {
    const skills = getSkills()
    const target = skills.find((s) => s.id === id)
    if (!target) return { success: false, error: 'Skill not found' }
    if (target.isBuiltIn) return { success: false, error: 'Cannot delete built-in skill' }
    saveSkills(skills.filter((s) => s.id !== id))
    return { success: true }
  })

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
