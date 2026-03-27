/**
 * 技能 Store（基于文件系统的 SKILL.md）
 * 管理技能的发现（扫描目录）、按需加载（读取完整指令）和目录操作
 * 技能以 SKILL.md 文件形式存储，不再通过 UI 表单 CRUD
 */
import { create } from 'zustand'
import type { Skill, SkillSummary } from '@shared/types/skill.types'

interface SkillState {
  /** 所有已发现技能的摘要列表（仅 name + description） */
  summaries: SkillSummary[]
  /** 已加载完整指令的技能缓存（id -> Skill） */
  loadedSkills: Record<string, Skill>
  /** 是否正在扫描中 */
  discovering: boolean
  /** 当前会话中已激活的技能 ID 集合（通过斜杠命令触发） */
  activeSkillIds: Set<string>

  /** 扫描技能目录，刷新摘要列表 */
  discoverSkills: () => Promise<void>
  /** 按需加载指定技能的完整指令 */
  loadSkill: (id: string) => Promise<Skill | null>
  /** 用系统文件管理器打开技能目录 */
  openSkillDir: () => Promise<void>
  /** 激活一个技能（加载其完整指令并标记为活跃） */
  activateSkill: (id: string) => Promise<void>
  /** 重置活跃技能（新会话时调用） */
  resetActiveSkills: () => void
  /** 构建技能概览提示（仅 name + description，注入系统提示） */
  getSkillSummaryPrompt: () => string
  /** 获取所有已激活技能的完整指令映射 */
  getActiveSkillInstructions: () => Record<string, string>
}

export const useSkillStore = create<SkillState>((set, get) => ({
  summaries: [],
  loadedSkills: {},
  discovering: false,
  activeSkillIds: new Set(),

  /** 扫描技能目录，更新摘要列表 */
  discoverSkills: async () => {
    set({ discovering: true })
    const res = await window.api.discoverSkills()
    if (res.success && res.data) {
      set({ summaries: res.data, discovering: false })
    } else {
      set({ discovering: false })
    }
  },

  /** 按需加载技能完整指令，结果缓存到 loadedSkills */
  loadSkill: async (id: string) => {
    // 检查缓存
    const cached = get().loadedSkills[id]
    if (cached) return cached

    const res = await window.api.loadSkill(id)
    if (res.success && res.data) {
      set((state) => ({
        loadedSkills: { ...state.loadedSkills, [id]: res.data! }
      }))
      return res.data
    }
    return null
  },

  /** 打开技能目录 */
  openSkillDir: async () => {
    await window.api.openSkillDir()
  },

  /** 激活技能：加载完整指令并标记为活跃 */
  activateSkill: async (id: string) => {
    const skill = await get().loadSkill(id)
    if (skill) {
      set((state) => {
        const newSet = new Set(state.activeSkillIds)
        newSet.add(id)
        return { activeSkillIds: newSet }
      })
    }
  },

  /** 重置活跃技能集合 */
  resetActiveSkills: () => {
    set({ activeSkillIds: new Set() })
  },

  /** 构建可用技能概览（注入系统提示，仅摘要级别） */
  getSkillSummaryPrompt: () => {
    const { summaries } = get()
    if (summaries.length === 0) return ''

    const listing = summaries
      .map((s) => `- /${s.name}: ${s.description}`)
      .join('\n')

    return `\n\n# Available Skills\n\n${listing}`
  },

  /** 获取所有已激活技能的完整指令（name -> instructions） */
  getActiveSkillInstructions: () => {
    const { activeSkillIds, loadedSkills } = get()
    const result: Record<string, string> = {}
    for (const id of activeSkillIds) {
      const skill = loadedSkills[id]
      if (skill) {
        result[skill.meta.name] = skill.instructions
      }
    }
    return result
  }
}))
