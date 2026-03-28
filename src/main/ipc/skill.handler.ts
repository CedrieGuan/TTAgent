/**
 * 文件技能 IPC Handler
 * 处理技能的发现（扫描 SKILL.md 文件）、加载（读取完整指令）和打开目录操作
 * 技能以 SKILL.md 文件形式存储在 app userData 目录下
 */
import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/ipc.channels'
import { logger } from '../logger'
import type { IPCResponse } from '@shared/types/ipc.types'
import type { Skill, SkillSummary } from '@shared/types/skill.types'
import {
  discoverSkills,
  loadSkill,
  ensureSkillsDir,
  ensureExampleSkill
} from '../lib/skill-parser'


export function registerSkillHandlers(): void {
  // 首次注册时确保技能目录存在，并创建示例技能
  ensureSkillsDir()
  ensureExampleSkill()

  /** 扫描技能目录，返回所有技能的摘要（仅 name + description） */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_DISCOVER,
    (): IPCResponse<SkillSummary[]> => {
      try {
        const summaries = discoverSkills()
        return { success: true, data: summaries }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        return { success: false, error }
      }
    }
  )

  /** 按技能 ID 加载完整的指令内容（含 markdown 正文和辅助文件列表） */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_LOAD,
    (_event, skillId: string): IPCResponse<Skill> => {
      try {
        const skill = loadSkill(skillId)
        if (!skill) return { success: false, error: `技能 "${skillId}" 未找到` }
        return { success: true, data: skill }
      } catch (err) {
        logger.skill.error('加载技能失败:', skillId, err)
        const error = err instanceof Error ? err.message : String(err)
        return { success: false, error }
      }
    }
  )

  /** 用系统文件管理器打开技能根目录，方便用户创建/编辑 SKILL.md 文件 */
  ipcMain.handle(
    IPC_CHANNELS.SKILL_OPEN_DIR,
    async (): Promise<IPCResponse> => {
      try {
        const dir = ensureSkillsDir()
        await shell.openPath(dir)
        return { success: true }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        return { success: false, error }
      }
    }
  )
}
