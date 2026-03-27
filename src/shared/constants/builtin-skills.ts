import type { AgentSkill } from '../types/skill.types'

const now = Date.now()

export const BUILT_IN_SKILLS: AgentSkill[] = [
  {
    id: 'builtin-code-review',
    name: '代码审查',
    description: '审查代码质量、发现潜在问题并给出改进建议',
    instructions: `You are a code reviewer. When the user shares code, analyze it for:
- Bugs and potential runtime errors
- Security vulnerabilities
- Performance issues
- Code style and readability
- Best practices violations
Provide specific, actionable feedback with code examples where appropriate.`,
    enabled: false,
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'builtin-translation',
    name: '翻译助手',
    description: '高质量多语言翻译，保持原文语气和语境',
    instructions: `You are a professional translator. When the user provides text:
- Translate accurately while preserving tone, style, and context
- For technical terms, provide both translated and original forms
- If the text contains idioms, provide culturally appropriate equivalents
- Always indicate the source and target languages in your response`,
    enabled: false,
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'builtin-writing',
    name: '写作助手',
    description: '帮助撰写、润色、改写各类文本内容',
    instructions: `You are a writing assistant. Help the user with:
- Drafting new content (articles, emails, reports, etc.)
- Polishing and refining existing text
- Adapting tone and style for different audiences
- Fixing grammar, punctuation, and flow issues
Always maintain the user's intended meaning while improving clarity and impact.`,
    enabled: false,
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'builtin-data-analysis',
    name: '数据分析',
    description: '帮助分析数据、生成图表描述、解读趋势',
    instructions: `You are a data analysis expert. When the user provides data:
- Identify patterns, trends, and anomalies
- Suggest appropriate visualizations
- Provide statistical insights
- Explain findings in clear, non-technical language when needed
- Recommend actionable next steps based on the data`,
    enabled: false,
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  }
]
