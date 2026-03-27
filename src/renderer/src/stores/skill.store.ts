/**
 * 技能 Store
 * 管理 Agent 技能的加载、创建、更新、删除和启用/禁用
 */
import { create } from 'zustand'
import type { AgentSkill } from '@shared/types/skill.types'

interface SkillState {
  skills: AgentSkill[]
  loaded: boolean

  loadSkills: () => Promise<void>
  createSkill: (
    skill: Omit<AgentSkill, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<AgentSkill | null>
  updateSkill: (
    id: string,
    updates: Partial<Pick<AgentSkill, 'name' | 'description' | 'instructions'>>
  ) => Promise<AgentSkill | null>
  deleteSkill: (id: string) => Promise<boolean>
  toggleSkill: (id: string, enabled: boolean) => Promise<void>
  /** 获取所有已启用的技能（用于构建系统提示） */
  getEnabledSkills: () => AgentSkill[]
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  loaded: false,

  /** 从主进程加载所有技能 */
  loadSkills: async () => {
    const res = await window.api.listSkills()
    if (res.success && res.data) {
      set({ skills: res.data, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  /** 创建新技能，成功后追加到列表 */
  createSkill: async (skill) => {
    const res = await window.api.createSkill(skill)
    if (res.success && res.data) {
      set((state) => ({ skills: [...state.skills, res.data!] }))
      return res.data
    }
    return null
  },

  /** 更新技能属性 */
  updateSkill: async (id, updates) => {
    const res = await window.api.updateSkill(id, updates)
    if (res.success && res.data) {
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? res.data! : s))
      }))
      return res.data
    }
    return null
  },

  /** 删除技能（内置技能会在主进程拒绝） */
  deleteSkill: async (id) => {
    const res = await window.api.deleteSkill(id)
    if (res.success) {
      set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }))
      return true
    }
    return false
  },

  /** 切换技能的启用/禁用状态 */
  toggleSkill: async (id, enabled) => {
    const res = await window.api.toggleSkill(id, enabled)
    if (res.success && res.data) {
      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? res.data! : s))
      }))
    }
  },

  getEnabledSkills: () => get().skills.filter((s) => s.enabled)
}))
