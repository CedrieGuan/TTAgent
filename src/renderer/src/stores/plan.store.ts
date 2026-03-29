/**
 * 计划 Store
 * 管理计划列表、分组信息、当前编辑内容和 CRUD 操作
 * 使用 immer 中间件支持不可变状态更新
 */
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Plan, PlanGroup } from '@shared/types/plan.types'

interface PlanState {
  plans: Plan[]
  groups: PlanGroup[]
  assignments: Record<string, string | null>
  activePlanId: string | null
  editorContent: string
  isDirty: boolean
  loading: boolean
  saving: boolean

  loadPlans: () => Promise<void>
  openPlan: (planId: string) => Promise<void>
  updateEditorContent: (content: string) => void
  saveCurrentPlan: () => Promise<void>
  createPlan: (title: string) => Promise<void>
  deletePlan: (planId: string) => Promise<void>
  importPlans: (filePaths: string[]) => Promise<void>

  createGroup: (name: string) => Promise<void>
  updateGroup: (
    groupId: string,
    updates: Partial<Pick<PlanGroup, 'name' | 'collapsed'>>
  ) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  assignPlanToGroup: (planId: string, groupId: string | null) => Promise<void>
}

export const usePlanStore = create<PlanState>()(
  immer((set, get) => ({
    plans: [],
    groups: [],
    assignments: {},
    activePlanId: null,
    editorContent: '',
    isDirty: false,
    loading: false,
    saving: false,

    loadPlans: async () => {
      set((s) => {
        s.loading = true
      })

      const [plansRes, groupsRes] = await Promise.all([
        window.api.listPlans(),
        window.api.listPlanGroups()
      ])

      set((s) => {
        if (plansRes.success && plansRes.data) s.plans = plansRes.data!
        if (groupsRes.success && groupsRes.data) {
          s.groups = groupsRes.data!.groups
          s.assignments = groupsRes.data!.assignments
        }
        s.loading = false
      })
    },

    openPlan: async (planId) => {
      const { activePlanId, isDirty } = get()
      if (activePlanId === planId) return

      // 切换前自动保存当前脏内容
      if (activePlanId && isDirty) {
        await get().saveCurrentPlan()
      }

      set((s) => {
        s.loading = true
      })
      const res = await window.api.readPlan(planId)
      if (res.success && res.data) {
        set((s) => {
          s.activePlanId = planId
          s.editorContent = res.data!.content
          s.isDirty = false
          s.loading = false
        })
      } else {
        set((s) => {
          s.loading = false
        })
      }
    },

    updateEditorContent: (content) => {
      set((s) => {
        s.editorContent = content
        s.isDirty = true
      })
    },

    saveCurrentPlan: async () => {
      const { activePlanId, editorContent, isDirty, saving } = get()
      if (!activePlanId || !isDirty || saving) return

      set((s) => {
        s.saving = true
      })
      const res = await window.api.savePlan(activePlanId, editorContent)
      if (res.success && res.data) {
        set((s) => {
          const idx = s.plans.findIndex((p) => p.id === activePlanId)
          if (idx !== -1) s.plans[idx] = res.data!
          s.plans.sort((a, b) => b.updatedAt - a.updatedAt)
          s.isDirty = false
          s.saving = false
        })
      } else {
        set((s) => {
          s.saving = false
        })
      }
    },

    createPlan: async (title) => {
      const res = await window.api.createPlan(title)
      if (res.success && res.data) {
        set((s) => {
          s.plans.unshift(res.data!)
          s.activePlanId = res.data!.id
          s.editorContent = `# ${title}\n`
          s.isDirty = false
        })
      }
    },

    deletePlan: async (planId) => {
      const res = await window.api.deletePlan(planId)
      if (res.success) {
        set((s) => {
          s.plans = s.plans.filter((p) => p.id !== planId)
          delete s.assignments[planId]
          if (s.activePlanId === planId) {
            s.activePlanId = null
            s.editorContent = ''
            s.isDirty = false
          }
        })
      }
    },

    importPlans: async (filePaths) => {
      const res = await window.api.importPlans(filePaths)
      if (res.success && res.data) {
        const importedIds = new Set(res.data!.map((p) => p.id))
        set((s) => {
          // 去重：已有同 id 不重复添加
          for (const plan of res.data!) {
            if (!s.plans.some((p) => p.id === plan.id)) {
              s.plans.push(plan)
            }
          }
          s.plans.sort((a, b) => b.updatedAt - a.updatedAt)
          // 若导入后无激活计划，自动打开第一个导入的
          if (!s.activePlanId && res.data!.length > 0) {
            const firstImported = res.data![0]
            s.activePlanId = firstImported.id
            s.editorContent = ''
            s.isDirty = false
          }
        })
        // 自动加载第一个导入的内容
        const state = get()
        if (state.activePlanId && importedIds.has(state.activePlanId) && !state.editorContent) {
          await get().openPlan(state.activePlanId)
        }
      }
    },

    // ── 分组操作 ────────────────────────────────────────────────

    createGroup: async (name) => {
      const res = await window.api.createPlanGroup(name)
      if (res.success && res.data) {
        set((s) => {
          s.groups.push(res.data!)
        })
      }
    },

    updateGroup: async (groupId, updates) => {
      const res = await window.api.updatePlanGroup(groupId, updates)
      if (res.success && res.data) {
        set((s) => {
          const idx = s.groups.findIndex((g) => g.id === groupId)
          if (idx !== -1) s.groups[idx] = res.data!
        })
      }
    },

    deleteGroup: async (groupId) => {
      const res = await window.api.deletePlanGroup(groupId)
      if (res.success) {
        set((s) => {
          s.groups = s.groups.filter((g) => g.id !== groupId)
          // 该分组下的计划回归未分组
          for (const planId of Object.keys(s.assignments)) {
            if (s.assignments[planId] === groupId) {
              delete s.assignments[planId]
            }
          }
        })
      }
    },

    assignPlanToGroup: async (planId, groupId) => {
      const res = await window.api.assignPlanToGroup(planId, groupId)
      if (res.success) {
        set((s) => {
          if (groupId === null) {
            delete s.assignments[planId]
          } else {
            s.assignments[planId] = groupId
          }
        })
      }
    }
  }))
)
