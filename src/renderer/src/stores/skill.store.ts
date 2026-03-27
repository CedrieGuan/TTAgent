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
  getEnabledSkills: () => AgentSkill[]
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  loaded: false,

  loadSkills: async () => {
    const res = await window.api.listSkills()
    if (res.success && res.data) {
      set({ skills: res.data, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  createSkill: async (skill) => {
    const res = await window.api.createSkill(skill)
    if (res.success && res.data) {
      set((state) => ({ skills: [...state.skills, res.data!] }))
      return res.data
    }
    return null
  },

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

  deleteSkill: async (id) => {
    const res = await window.api.deleteSkill(id)
    if (res.success) {
      set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }))
      return true
    }
    return false
  },

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
