/**
 * SKILL.md 解析与发现模块
 * 负责在文件系统中扫描 SKILL.md 文件、解析 YAML frontmatter 和 markdown 正文
 * 技能存放在 app userData 目录下的 skills/ 子目录中
 */
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import matter from 'gray-matter'
import type { Skill, SkillSummary, SkillMeta } from '@shared/types/skill.types'
import { logger } from '../logger'

/** 返回全局技能根目录路径（userData/skills/） */
export function getSkillsDir(): string {
  return path.join(app.getPath('userData'), 'skills')
}

/** 确保技能根目录存在，不存在则递归创建 */
export function ensureSkillsDir(): string {
  const dir = getSkillsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 扫描技能根目录，发现所有包含 SKILL.md 的子目录
 * 返回技能摘要列表（仅 name + description），用于渐进式加载的第一步
 */
export function discoverSkills(): SkillSummary[] {
  const skillsDir = ensureSkillsDir()
  const summaries: SkillSummary[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = path.join(skillsDir, entry.name)
    const skillFile = path.join(skillDir, 'SKILL.md')

    if (!fs.existsSync(skillFile)) continue

    try {
      const raw = fs.readFileSync(skillFile, 'utf-8')
      const parsed = matter(raw)
      const meta = parseMeta(parsed.data, entry.name)

      summaries.push({
        id: entry.name,
        name: meta.name,
        description: meta.description,
        disableModelInvocation: meta.disableModelInvocation ?? false,
        filePath: skillFile
      })
    } catch (err) {
      logger.skill.warn(`解析技能 ${entry.name}/SKILL.md 失败:`, err)
    }
  }

  return summaries
}

/**
 * 加载指定技能的完整数据（含 markdown 正文指令和辅助文件列表）
 * 用于渐进式加载的第二步：用户触发或 AI 匹配时按需加载
 */
export function loadSkill(skillId: string): Skill | null {
  const skillsDir = getSkillsDir()
  const skillDir = path.join(skillsDir, skillId)
  const skillFile = path.join(skillDir, 'SKILL.md')

  if (!fs.existsSync(skillFile)) return null

  try {
    const raw = fs.readFileSync(skillFile, 'utf-8')
    const parsed = matter(raw)
    const meta = parseMeta(parsed.data, skillId)

    // 列出技能目录中 SKILL.md 以外的辅助文件
    const supportingFiles = listSupportingFiles(skillDir)

    return {
      id: skillId,
      meta,
      instructions: parsed.content.trim(),
      filePath: skillFile,
      dirPath: skillDir,
      supportingFiles
    }
  } catch (err) {
    logger.skill.error(`加载技能 ${skillId} 失败:`, err)
    return null
  }
}

/**
 * 从 frontmatter 数据中提取技能元数据
 * 若缺少 name 则使用目录名，缺少 description 则使用空字符串
 */
function parseMeta(data: Record<string, unknown>, dirName: string): SkillMeta {
  return {
    name: typeof data.name === 'string' ? data.name : dirName,
    description: typeof data.description === 'string' ? data.description : '',
    disableModelInvocation: data['disable-model-invocation'] === true
  }
}

/**
 * 列出技能目录中 SKILL.md 以外的所有文件（递归）
 * 返回相对于技能目录的路径列表
 */
function listSupportingFiles(skillDir: string): string[] {
  const files: string[] = []

  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const relative = path.relative(skillDir, fullPath)
        // 排除 SKILL.md 本身
        if (relative.toUpperCase() !== 'SKILL.MD') {
          files.push(relative)
        }
      }
    }
  }

  walk(skillDir)
  return files
}

/**
 * 首次启动时创建示例技能
 * 如果技能目录为空，则自动创建一个 code-review 示例
 */
export function ensureExampleSkill(): void {
  const skillsDir = ensureSkillsDir()
  const exampleDir = path.join(skillsDir, 'code-review')
  const exampleFile = path.join(exampleDir, 'SKILL.md')

  // 只在技能目录完全为空时创建示例
  try {
    const entries = fs.readdirSync(skillsDir)
    if (entries.length > 0) return
  } catch {
    return
  }

  fs.mkdirSync(exampleDir, { recursive: true })
  fs.writeFileSync(
    exampleFile,
    `---
name: code-review
description: 审查代码质量、发现潜在问题并给出改进建议。当用户分享代码段并请求审查时使用。
---

当用户分享代码时，分析以下方面：

1. **Bug 和潜在运行时错误**
2. **安全漏洞**
3. **性能问题**
4. **代码风格与可读性**
5. **最佳实践违反**

提供具体、可操作的反馈，并在适当时给出代码示例。
`,
    'utf-8'
  )
}
