/**
 * SKILL.md 解析与发现模块
 * 负责在文件系统中扫描 SKILL.md 文件、解析 YAML frontmatter 和 markdown 正文
 *
 * 扫描两个来源（按优先级：项目内优先，userData 补充）：
 *   1. 项目内 skills/ 目录（随代码版本管理，可 git 提交）
 *      - 开发模式：<项目根目录>/skills/
 *      - 打包后：<resources>/skills/
 *   2. userData/skills/ 目录（用户自建技能，不进 git）
 */
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import matter from 'gray-matter'
import type { Skill, SkillSummary, SkillMeta } from '@shared/types/skill.types'

/**
 * 返回项目内置技能目录路径
 * 开发模式下为项目根目录的 skills/，打包后为 resources/skills/
 */
function getBundledSkillsDir(): string {
  if (!app.isPackaged) {
    // 开发模式：src/main/lib/ → 上三级为项目根
    return path.join(__dirname, '..', '..', '..', 'skills')
  }
  // 打包后：resources/skills/
  return path.join(process.resourcesPath, 'skills')
}

/** 返回用户自建技能根目录路径（userData/skills/） */
export function getSkillsDir(): string {
  return path.join(app.getPath('userData'), 'skills')
}

/** 确保用户技能根目录存在，不存在则递归创建 */
export function ensureSkillsDir(): string {
  const dir = getSkillsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 返回所有需要扫描的技能目录（项目内置 + 用户自建）
 * 项目内置目录优先，重名时用户目录中的技能会覆盖内置技能
 */
function getAllSkillsDirs(): string[] {
  const dirs: string[] = []
  const bundledDir = getBundledSkillsDir()
  if (fs.existsSync(bundledDir)) dirs.push(bundledDir)
  const userDir = ensureSkillsDir()
  if (fs.existsSync(userDir)) dirs.push(userDir)
  return dirs
}

/**
 * 扫描所有技能目录（项目内置 + 用户自建），发现所有包含 SKILL.md 的子目录
 * 返回技能摘要列表（仅 name + description），用于渐进式加载的第一步
 * 用户目录中同名技能会覆盖内置技能（后扫描的覆盖先扫描的）
 */
export function discoverSkills(): SkillSummary[] {
  const skillsDirs = getAllSkillsDirs()
  // 用 Map 去重：相同 id 的技能，后扫描（用户目录）覆盖先扫描（内置目录）
  const summaryMap = new Map<string, SkillSummary>()

  for (const skillsDir of skillsDirs) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    } catch {
      continue
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

        summaryMap.set(entry.name, {
          id: entry.name,
          name: meta.name,
          description: meta.description,
          disableModelInvocation: meta.disableModelInvocation ?? false,
          filePath: skillFile
        })
      } catch (err) {
        console.warn(`解析技能 ${entry.name}/SKILL.md 失败:`, err)
      }
    }
  }

  return Array.from(summaryMap.values())
}

/**
 * 加载指定技能的完整数据（含 markdown 正文指令和辅助文件列表）
 * 用于渐进式加载的第二步：用户触发或 AI 匹配时按需加载
 * 优先从用户目录加载（后者可覆盖内置技能）
 */
export function loadSkill(skillId: string): Skill | null {
  // 逆序查找：用户目录优先（排在 getAllSkillsDirs 后面）
  const skillsDirs = getAllSkillsDirs().reverse()
  let skillDir: string | null = null
  for (const dir of skillsDirs) {
    const candidate = path.join(dir, skillId)
    if (fs.existsSync(path.join(candidate, 'SKILL.md'))) {
      skillDir = candidate
      break
    }
  }

  if (!skillDir) return null

  const skillFile = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillFile)) return null

  try {
    const raw = fs.readFileSync(skillFile, 'utf-8')
    const parsed = matter(raw)
    const meta = parseMeta(parsed.data, skillId)

    // 列出技能目录中 SKILL.md 以外的辅助文件（skillDir 已在上方确认非 null）
    const supportingFiles = listSupportingFiles(skillDir as string)

    return {
      id: skillId,
      meta,
      instructions: parsed.content.trim(),
      filePath: skillFile,
      dirPath: skillDir,
      supportingFiles
    }
  } catch (err) {
    console.error(`加载技能 ${skillId} 失败:`, err)
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
