/**
 * 计划（Plans）IPC Handler
 * 管理 Markdown 文件的 CRUD 操作，含启动时从 ~/.claude/plans/ 自动导入
 * 以及计划分组的 CRUD 和分配操作（持久化到 groups.json）
 */
import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { logger } from '../logger'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { Plan, PlanWithContent, PlanGroup, PlanGroupData } from '@shared/types/plan.types'

function getPlansDir(): string {
  return path.join(app.getPath('userData'), 'plans')
}

function ensurePlansDir(): void {
  const dir = getPlansDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getGroupsFilePath(): string {
  return path.join(getPlansDir(), 'groups.json')
}

/** 读取分组数据，文件不存在则返回空结构 */
function readGroupsData(): PlanGroupData {
  const filePath = getGroupsFilePath()
  if (!fs.existsSync(filePath)) {
    return { groups: [], assignments: {} }
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as PlanGroupData
  } catch {
    return { groups: [], assignments: {} }
  }
}

/** 写入分组数据 */
function writeGroupsData(data: PlanGroupData): void {
  ensurePlansDir()
  fs.writeFileSync(getGroupsFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

function statToPlan(filePath: string, fileName: string): Plan {
  const stat = fs.statSync(filePath)
  return {
    id: path.basename(fileName, '.md'),
    title: path.basename(fileName, '.md'),
    filePath,
    updatedAt: stat.mtimeMs,
    createdAt: stat.birthtimeMs,
    size: stat.size
  }
}

/** 同名冲突时自动追加 -1, -2 后缀 */
function resolveUniqueFilePath(dir: string, baseName: string): string {
  let target = path.join(dir, `${baseName}.md`)
  if (!fs.existsSync(target)) return target

  let i = 1
  while (fs.existsSync(path.join(dir, `${baseName}-${i}.md`))) {
    i++
  }
  return path.join(dir, `${baseName}-${i}.md`)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

/** 启动时自动从 ~/.claude/plans/ 导入 .md 文件 */
function autoImportFromClaudePlans(): void {
  try {
    const claudePlansDir = path.join(os.homedir(), '.claude', 'plans')
    if (!fs.existsSync(claudePlansDir)) return

    const files = fs.readdirSync(claudePlansDir).filter((f) => f.endsWith('.md'))
    if (files.length === 0) return

    ensurePlansDir()
    const plansDir = getPlansDir()
    const existingFiles = new Set(fs.readdirSync(plansDir))

    for (const file of files) {
      if (existingFiles.has(file)) continue
      const src = path.join(claudePlansDir, file)
      const baseName = path.basename(file, '.md')
      const dest = resolveUniqueFilePath(plansDir, baseName)
      fs.copyFileSync(src, dest)
      logger.plan.info(`自动导入计划文件: ${file}`)
    }
  } catch (err) {
    logger.plan.error('自动导入 ~/.claude/plans/ 失败:', err)
  }
}

export function registerPlanHandlers(): void {
  ensurePlansDir()
  autoImportFromClaudePlans()

  // ── 计划文件 CRUD ──────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.PLAN_LIST, (): IPCResponse<Plan[]> => {
    try {
      const dir = getPlansDir()
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
      const plans = files
        .map((f) => statToPlan(path.join(dir, f), f))
        .sort((a, b) => b.updatedAt - a.updatedAt)
      return { success: true, data: plans }
    } catch (err) {
      logger.plan.error('获取计划列表失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PLAN_CREATE, (_event, title: string): IPCResponse<Plan> => {
    try {
      const safeName = sanitizeFileName(title || 'untitled')
      if (!safeName) return { success: false, error: '名称不能为空' }

      const dir = getPlansDir()
      const filePath = resolveUniqueFilePath(dir, safeName)
      const content = `# ${title}\n`
      fs.writeFileSync(filePath, content, 'utf-8')

      const fileName = path.basename(filePath)
      const plan = statToPlan(filePath, fileName)
      return { success: true, data: plan }
    } catch (err) {
      logger.plan.error('创建计划失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PLAN_READ, (_event, planId: string): IPCResponse<PlanWithContent> => {
    try {
      const filePath = path.join(getPlansDir(), `${planId}.md`)
      if (!fs.existsSync(filePath)) return { success: false, error: '计划不存在' }

      const content = fs.readFileSync(filePath, 'utf-8')
      const plan = statToPlan(filePath, `${planId}.md`)
      return { success: true, data: { ...plan, content } }
    } catch (err) {
      logger.plan.error('读取计划失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PLAN_SAVE,
    (_event, planId: string, content: string): IPCResponse<Plan> => {
      try {
        const filePath = path.join(getPlansDir(), `${planId}.md`)
        if (!fs.existsSync(filePath)) return { success: false, error: '计划不存在' }

        fs.writeFileSync(filePath, content, 'utf-8')
        const plan = statToPlan(filePath, `${planId}.md`)
        return { success: true, data: plan }
      } catch (err) {
        logger.plan.error('保存计划失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PLAN_DELETE, (_event, planId: string): IPCResponse => {
    try {
      const filePath = path.join(getPlansDir(), `${planId}.md`)
      if (!fs.existsSync(filePath)) return { success: false, error: '计划不存在' }

      fs.unlinkSync(filePath)

      // 同步清理分组分配
      const data = readGroupsData()
      if (data.assignments[planId] !== undefined) {
        delete data.assignments[planId]
        writeGroupsData(data)
      }

      return { success: true }
    } catch (err) {
      logger.plan.error('删除计划失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PLAN_IMPORT, (_event, filePaths: string[]): IPCResponse<Plan[]> => {
    try {
      const dir = getPlansDir()
      const imported: Plan[] = []

      for (const srcPath of filePaths) {
        if (!fs.existsSync(srcPath)) continue

        const baseName = sanitizeFileName(path.basename(srcPath, '.md'))
        if (!baseName) continue

        const destPath = resolveUniqueFilePath(dir, baseName)
        fs.copyFileSync(srcPath, destPath)

        const fileName = path.basename(destPath)
        imported.push(statToPlan(destPath, fileName))
      }

      return { success: true, data: imported }
    } catch (err) {
      logger.plan.error('导入计划失败:', err)
      return { success: false, error: String(err) }
    }
  })

  // ── 分组 CRUD ─────────────────────────────────────────────────

  ipcMain.handle(
    IPC_CHANNELS.PLAN_GROUP_LIST,
    (): IPCResponse<{ groups: PlanGroup[]; assignments: Record<string, string | null> }> => {
      try {
        const data = readGroupsData()
        return { success: true, data: { groups: data.groups, assignments: data.assignments } }
      } catch (err) {
        logger.plan.error('获取分组列表失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PLAN_GROUP_CREATE, (_event, name: string): IPCResponse<PlanGroup> => {
    try {
      const data = readGroupsData()
      const group: PlanGroup = {
        id: randomUUID(),
        name,
        collapsed: false,
        order: data.groups.length
      }
      data.groups.push(group)
      writeGroupsData(data)
      return { success: true, data: group }
    } catch (err) {
      logger.plan.error('创建分组失败:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PLAN_GROUP_UPDATE,
    (
      _event,
      groupId: string,
      updates: Partial<Pick<PlanGroup, 'name' | 'collapsed'>>
    ): IPCResponse<PlanGroup> => {
      try {
        const data = readGroupsData()
        const idx = data.groups.findIndex((g) => g.id === groupId)
        if (idx === -1) return { success: false, error: '分组不存在' }

        if (updates.name !== undefined) data.groups[idx].name = updates.name
        if (updates.collapsed !== undefined) data.groups[idx].collapsed = updates.collapsed

        writeGroupsData(data)
        return { success: true, data: data.groups[idx] }
      } catch (err) {
        logger.plan.error('更新分组失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PLAN_GROUP_DELETE, (_event, groupId: string): IPCResponse => {
    try {
      const data = readGroupsData()
      data.groups = data.groups.filter((g) => g.id !== groupId)

      // 该分组下的计划回归未分组
      for (const planId of Object.keys(data.assignments)) {
        if (data.assignments[planId] === groupId) {
          delete data.assignments[planId]
        }
      }

      writeGroupsData(data)
      return { success: true }
    } catch (err) {
      logger.plan.error('删除分组失败:', err)
      return { success: false, error: String(err) }
    }
  })

  /** 将计划分配到分组（groupId 为 null 时移出分组） */
  ipcMain.handle(
    IPC_CHANNELS.PLAN_ASSIGN_GROUP,
    (_event, planId: string, groupId: string | null): IPCResponse => {
      try {
        const data = readGroupsData()

        if (groupId === null) {
          delete data.assignments[planId]
        } else {
          if (!data.groups.some((g) => g.id === groupId)) {
            return { success: false, error: '分组不存在' }
          }
          data.assignments[planId] = groupId
        }

        writeGroupsData(data)
        return { success: true }
      } catch (err) {
        logger.plan.error('分配分组失败:', err)
        return { success: false, error: String(err) }
      }
    }
  )
}
