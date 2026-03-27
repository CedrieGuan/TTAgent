/**
 * useSlashCommand Hook
 * 提供斜杠命令的检测、候选列表筛选和选中回调
 * 当用户在聊天输入中键入 / 时，展示匹配的技能列表
 */
import { useMemo, useCallback } from 'react'
import { useSkillStore } from '@stores/skill.store'
import type { SkillSummary } from '@shared/types/skill.types'

interface SlashCommandResult {
  /** 当前是否处于斜杠命令模式（输入以 / 开头） */
  isActive: boolean
  /** 筛选后的候选技能列表 */
  candidates: SkillSummary[]
  /** 选中某个技能后的回调：返回更新后的输入文本 */
  selectSkill: (skill: SkillSummary) => string
}

/**
 * 检测输入文本中的斜杠命令并提供候选列表
 * @param inputText 当前输入框的文本
 */
export function useSlashCommand(inputText: string): SlashCommandResult {
  const { summaries } = useSkillStore()

  /** 解析输入中的斜杠前缀和查询关键词 */
  const { isActive, query } = useMemo(() => {
    // 仅在输入以 / 开头且没有换行时才激活（避免多行输入误触发）
    const firstLine = inputText.split('\n')[0]
    if (!firstLine.startsWith('/')) {
      return { isActive: false, query: '' }
    }

    // 提取 / 后面的关键词（到第一个空格或行尾）
    const match = firstLine.match(/^\/([\w-]*)/)
    if (!match) return { isActive: false, query: '' }

    return { isActive: true, query: match[1].toLowerCase() }
  }, [inputText])

  /** 根据关键词筛选候选技能 */
  const candidates = useMemo(() => {
    if (!isActive) return []

    // 空查询时显示所有非 disableModelInvocation 的技能
    if (!query) {
      return summaries.filter((s) => !s.disableModelInvocation || true)
    }

    // 模糊匹配 name 和 description
    return summaries.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    )
  }, [isActive, query, summaries])

  /** 选中技能后，替换输入文本为 /skill-name + 光标位置留空 */
  const selectSkill = useCallback(
    (skill: SkillSummary): string => {
      // 保留 / 命令后面用户已输入的其他内容
      const rest = inputText.replace(/^\/[\w-]*\s*/, '')
      return `/${skill.name} ${rest}`
    },
    [inputText]
  )

  return { isActive, candidates, selectSkill }
}
