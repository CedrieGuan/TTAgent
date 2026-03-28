/**
 * 本地内置工具模块
 * 提供文件读写、目录列表、Shell 命令执行等本地能力
 * 以及 Ozon POD 选品专用工具（利润计算、节假日日历、设计评分、AI 抠图、SKU 生成）
 * 工具名称统一以 "local_" 前缀标识
 */
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { resolve, join, dirname, extname, basename } from 'path'
import { homedir } from 'os'
import type { MCPTool } from '@shared/types/mcp.types'

/** 本地工具执行器接口 */
export interface LocalToolExecutor {
  execute(args: Record<string, unknown>): Promise<string>
}

interface LocalToolDefinition {
  tool: MCPTool
  executor: LocalToolExecutor
}

const LOCAL_TOOL_PREFIX = 'local_'

function localTool(name: string): string {
  return `${LOCAL_TOOL_PREFIX}${name}`
}

/** 判断工具名称是否为本地工具 */
export function isLocalTool(toolName: string): boolean {
  return toolName.startsWith(LOCAL_TOOL_PREFIX)
}

// ── 工具定义 ──────────────────────────────────────────────────

/** 读取文件内容，支持行号偏移和行数限制 */
const readFileDef: LocalToolDefinition = {
  tool: {
    name: localTool('read_file'),
    description: 'Read the contents of a file at the given path. Returns the file content as text.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to read'
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-indexed). Defaults to 1.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of lines to read. Defaults to 2000.'
        }
      },
      required: ['path']
    }
  },
  executor: {
    async execute(args) {
      const filePath = resolvePath(args.path as string)
      if (!existsSync(filePath)) return `Error: File not found: ${filePath}`
      try {
        const content = await readFile(filePath, 'utf-8')
        const lines = content.split('\n')
        const offset = Math.max(1, (args.offset as number) ?? 1)
        const limit = (args.limit as number) ?? 2000
        const sliced = lines.slice(offset - 1, offset - 1 + limit)
        // 返回带行号的内容，便于 AI 精确引用
        return sliced.map((line, i) => `${offset + i}: ${line}`).join('\n')
      } catch (err) {
        return `Error reading file: ${(err as Error).message}`
      }
    }
  }
}

/** 写入文件内容，自动创建父目录 */
const writeFileDef: LocalToolDefinition = {
  tool: {
    name: localTool('write_file'),
    description:
      'Write content to a file. Creates the file and any parent directories if they do not exist.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to write'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  executor: {
    async execute(args) {
      const filePath = resolvePath(args.path as string)
      const content = args.content as string
      try {
        const dir = dirname(filePath)
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true })
        }
        await writeFile(filePath, content, 'utf-8')
        return `Successfully wrote ${content.length} bytes to ${filePath}`
      } catch (err) {
        return `Error writing file: ${(err as Error).message}`
      }
    }
  }
}

/** 列出目录内容，目录名后附加 "/" 标识 */
const listDirectoryDef: LocalToolDefinition = {
  tool: {
    name: localTool('list_directory'),
    description:
      'List files and directories at the given path. Returns entries with type indicator (/ for directories).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the directory to list'
        }
      },
      required: ['path']
    }
  },
  executor: {
    async execute(args) {
      const dirPath = resolvePath(args.path as string)
      if (!existsSync(dirPath)) return `Error: Directory not found: ${dirPath}`
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        return entries.map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`).join('\n')
      } catch (err) {
        return `Error listing directory: ${(err as Error).message}`
      }
    }
  }
}

/** 执行 Shell 命令，返回 stdout + stderr，支持超时控制 */
const shellExecuteDef: LocalToolDefinition = {
  tool: {
    name: localTool('shell_execute'),
    description:
      'Execute a shell command and return its stdout and stderr. Use for running build commands, tests, git operations, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command. Defaults to the project root.'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds. Defaults to 120000 (2 minutes).'
        }
      },
      required: ['command']
    }
  },
  executor: {
    async execute(args) {
      const command = args.command as string
      const cwd = args.cwd ? resolvePath(args.cwd as string) : undefined
      const timeout = (args.timeout as number) ?? 120000

      try {
        const result = await new Promise<string>((resolvePromise) => {
          execFile(
            'sh',
            ['-c', command],
            { cwd, timeout, maxBuffer: 10 * 1024 * 1024 },
            (error, stdout, stderr) => {
              let output = ''
              if (stdout) output += stdout
              if (stderr) output += (output ? '\n' : '') + stderr
              if (error) {
                output += (output ? '\n' : '') + `Exit code: ${error.code ?? 'unknown'}`
              }
              resolvePromise(output)
            }
          )
        })
        return result || '(no output)'
      } catch (err) {
        return `Error executing command: ${(err as Error).message}`
      }
    }
  }
}

// ── Ozon POD 选品分析工具 ──────────────────────────────────────

/**
 * Ozon 各品类平台佣金率（referral fee），单位 %
 * 数据来源：Ozon 官方费率表（2024-2025）
 */
const OZON_COMMISSION_RATES: Record<string, number> = {
  'tshirt': 8, 'hoodie': 8, 'clothing': 8,
  'mug': 10, 'phone-case': 10, 'canvas-bag': 8,
  'pillow': 10, 'poster': 10, 'sticker': 8,
  'default': 10
}

/**
 * FBO 模式各费用比例（占销售价格的百分比）
 * 实际费率区间：物流 5%-7%，配送 5.5%
 */
const FBO_LOGISTICS_RATE = 0.06  // 履行费（含包装分拣），取区间中值
const FBO_DELIVERY_RATE = 0.055  // 配送费

/** 人民币/卢布汇率（近似值，1 CNY ≈ 11.75 RUB） */
const CNY_TO_RUB = 11.75

/** Ozon POD 利润计算工具，内置品类佣金/FBO 费率表，支持人民币/卢布双币种 */
const ozonProfitCalculatorDef: LocalToolDefinition = {
  tool: {
    name: localTool('ozon_profit_calculator'),
    description:
      '计算 Ozon POD 商品的利润空间。输入卢布售价、印刷成本和品类，自动扣除 Ozon 平台佣金和 FBO 物流费，输出净利润率和人民币等值收益。',
    inputSchema: {
      type: 'object',
      properties: {
        selling_price_rub: { type: 'number', description: '卢布售价（RUB）' },
        printing_cost_rub: { type: 'number', description: '印刷成本（含包装材料，RUB）' },
        product_category: {
          type: 'string',
          description: '品类，如 tshirt / mug / phone-case / canvas-bag / pillow / poster / sticker'
        },
        fulfillment_model: {
          type: 'string',
          enum: ['FBO', 'FBS'],
          description: 'FBO=平台仓库发货，FBS=商家自发货。默认 FBO'
        },
        settlement_currency: {
          type: 'string',
          enum: ['CNY', 'RUB'],
          description: '结算货币，默认 RUB'
        }
      },
      required: ['selling_price_rub', 'printing_cost_rub', 'product_category']
    }
  },
  executor: {
    async execute(args) {
      const price = args.selling_price_rub as number
      const printCost = args.printing_cost_rub as number
      const category = (args.product_category as string).toLowerCase()
      const model = (args.fulfillment_model as string) ?? 'FBO'

      const commissionRate = (OZON_COMMISSION_RATES[category] ?? OZON_COMMISSION_RATES['default']) / 100
      const commissionFee = price * commissionRate

      let logisticsFee = 0
      if (model === 'FBO') {
        logisticsFee = price * (FBO_LOGISTICS_RATE + FBO_DELIVERY_RATE)
      }

      const totalCost = printCost + commissionFee + logisticsFee
      const netProfit = price - totalCost
      const profitMarginPct = (netProfit / price) * 100
      const breakEvenPrice = totalCost / (1 - commissionRate - (model === 'FBO' ? FBO_LOGISTICS_RATE + FBO_DELIVERY_RATE : 0))
      const cnyEquivalent = netProfit / CNY_TO_RUB

      let verdict = 'VIABLE'
      if (profitMarginPct < 20) verdict = 'NOT_VIABLE'
      else if (profitMarginPct < 35) verdict = 'MARGINAL'

      return JSON.stringify({
        selling_price_rub: price,
        printing_cost_rub: printCost,
        ozon_commission_rub: Math.round(commissionFee * 100) / 100,
        ozon_commission_rate_pct: commissionRate * 100,
        fbo_logistics_fee_rub: model === 'FBO' ? Math.round(logisticsFee * 100) / 100 : 0,
        total_cost_rub: Math.round(totalCost * 100) / 100,
        net_profit_rub: Math.round(netProfit * 100) / 100,
        profit_margin_pct: Math.round(profitMarginPct * 10) / 10,
        break_even_price_rub: Math.round(breakEvenPrice),
        cny_equivalent: Math.round(cnyEquivalent * 100) / 100,
        fulfillment_model: model,
        verdict
      }, null, 2)
    }
  }
}

/**
 * 俄罗斯节假日数据库，含销售倍数和推荐设计主题
 * 上架时机建议：节日前 21-30 天
 */
const RUSSIAN_HOLIDAYS = [
  { month: 1, day: 1, name: '新年', sales_multiplier: 2.5, themes: ['新年礼物', '冬季', '家庭', '节日装饰'] },
  { month: 2, day: 14, name: '情人节', sales_multiplier: 1.6, themes: ['爱情', '情侣定制', '心形图案', '浪漫'] },
  { month: 2, day: 23, name: '祖国保卫者日（男人节）', sales_multiplier: 1.4, themes: ['军事幽默', '男性礼物', '爱国', '工具'] },
  { month: 3, day: 8, name: '妇女节', sales_multiplier: 1.8, themes: ['女性主题', '花卉', '妈妈', '女友礼物'] },
  { month: 5, day: 9, name: '胜利日', sales_multiplier: 1.8, themes: ['爱国', '苏联复古', '军事纪念', '退役军人礼物'] },
  { month: 6, day: 1, name: '儿童节', sales_multiplier: 1.3, themes: ['儿童', '卡通', '可爱', '家庭'] },
  { month: 9, day: 1, name: '返校节', sales_multiplier: 1.3, themes: ['学校', '学生', '文具', '青春'] },
  { month: 12, day: 31, name: '跨年夜', sales_multiplier: 2.5, themes: ['新年倒计时', '圣诞', '礼物', '家庭聚会'] }
]

/** 俄罗斯节假日日历工具，返回未来节假日列表和上架时机建议 */
const russianHolidayCalendarDef: LocalToolDefinition = {
  tool: {
    name: localTool('russian_holiday_calendar'),
    description:
      '查询俄罗斯节假日日历，返回未来购物节点、各节日 POD 设计主题建议、销售倍数和推荐上架时间（节日前 21-30 天）。',
    inputSchema: {
      type: 'object',
      properties: {
        lookahead_days: {
          type: 'number',
          description: '向前查看天数，默认 90'
        },
        reference_date: {
          type: 'string',
          description: '参考日期 YYYY-MM-DD，默认今天'
        }
      },
      required: []
    }
  },
  executor: {
    async execute(args) {
      const refDate = args.reference_date
        ? new Date(args.reference_date as string)
        : new Date()
      const lookahead = (args.lookahead_days as number) ?? 90
      const endDate = new Date(refDate.getTime() + lookahead * 24 * 60 * 60 * 1000)

      const upcoming: object[] = []
      // 检查当前年和下一年的节假日
      for (const yearOffset of [0, 1]) {
        const year = refDate.getFullYear() + yearOffset
        for (const h of RUSSIAN_HOLIDAYS) {
          const holidayDate = new Date(year, h.month - 1, h.day)
          if (holidayDate >= refDate && holidayDate <= endDate) {
            const daysUntil = Math.ceil((holidayDate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000))
            const launchDate = new Date(holidayDate.getTime() - 25 * 24 * 60 * 60 * 1000)
            upcoming.push({
              name: h.name,
              date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
              days_until: daysUntil,
              sales_multiplier: h.sales_multiplier,
              design_themes: h.themes,
              recommended_launch_date: launchDate.toISOString().slice(0, 10),
              days_until_launch: Math.max(0, Math.ceil((launchDate.getTime() - refDate.getTime()) / (24 * 60 * 60 * 1000)))
            })
          }
        }
      }

      upcoming.sort((a: any, b: any) => a.days_until - b.days_until)

      return JSON.stringify({
        reference_date: refDate.toISOString().slice(0, 10),
        lookahead_days: lookahead,
        upcoming_events: upcoming,
        note: '建议在节日前 21-30 天（recommended_launch_date）上架商品，给爬坑和广告预热留时间'
      }, null, 2)
    }
  }
}

/** POD 设计方向多维评分工具，综合需求/竞争/利润/文化/季节/版权六个维度打分 */
const podDesignScorerDef: LocalToolDefinition = {
  tool: {
    name: localTool('pod_design_scorer'),
    description:
      '对 Ozon POD 设计方向进行多维评分（需求热度、竞争烈度、利润空间、文化适配、季节性、版权风险），输出综合评分和推荐决策。',
    inputSchema: {
      type: 'object',
      properties: {
        design_name: { type: 'string', description: '设计方向名称或描述' },
        ozon_competitor_count: { type: 'number', description: 'Ozon 同类设计竞品数量' },
        avg_competitor_reviews: { type: 'number', description: '竞品平均评价数（反映市场成熟度）' },
        est_monthly_searches: { type: 'number', description: '预估月搜索量（可从 Ozon 卖家后台获取）' },
        profit_margin_pct: { type: 'number', description: '预估利润率 %（可使用 local_ozon_profit_calculator 计算）' },
        cultural_fit: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          description: '设计对俄罗斯消费者的文化适配度'
        },
        copyright_risk: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          description: '版权/知识产权风险评估'
        },
        target_holiday: { type: 'string', description: '关联节假日（可选），影响季节性评分' },
        days_until_holiday: { type: 'number', description: '距离节日天数（可选），用于评估时效性' }
      },
      required: ['design_name', 'ozon_competitor_count', 'profit_margin_pct']
    }
  },
  executor: {
    async execute(args) {
      const name = args.design_name as string
      const competitors = (args.ozon_competitor_count as number) ?? 0
      const avgReviews = (args.avg_competitor_reviews as number) ?? 0
      const monthlySearches = (args.est_monthly_searches as number) ?? 0
      const profitMargin = args.profit_margin_pct as number
      const culturalFit = (args.cultural_fit as string) ?? 'MEDIUM'
      const copyrightRisk = (args.copyright_risk as string) ?? 'LOW'
      const daysUntil = args.days_until_holiday as number | undefined

      // 需求评分（搜索量，越高越好）
      let demandScore = 50
      if (monthlySearches > 50000) demandScore = 95
      else if (monthlySearches > 10000) demandScore = 80
      else if (monthlySearches > 3000) demandScore = 65
      else if (monthlySearches > 500) demandScore = 45
      else if (monthlySearches > 0) demandScore = 25

      // 竞争评分（竞品越少、评价越少，评分越高）
      let competitionScore = 80
      if (competitors > 1000) competitionScore = 20
      else if (competitors > 500) competitionScore = 35
      else if (competitors > 200) competitionScore = 50
      else if (competitors > 100) competitionScore = 65
      else if (competitors > 50) competitionScore = 75
      if (avgReviews > 2000) competitionScore = Math.max(20, competitionScore - 20)
      else if (avgReviews > 500) competitionScore = Math.max(30, competitionScore - 10)

      // 利润评分
      let profitScore = 0
      if (profitMargin >= 50) profitScore = 95
      else if (profitMargin >= 40) profitScore = 80
      else if (profitMargin >= 30) profitScore = 65
      else if (profitMargin >= 20) profitScore = 40
      else profitScore = 10

      // 文化适配评分
      const culturalScore = culturalFit === 'HIGH' ? 90 : culturalFit === 'MEDIUM' ? 60 : 25

      // 季节性评分
      let seasonalScore = 60  // 常青款默认 60
      if (daysUntil !== undefined) {
        if (daysUntil >= 15 && daysUntil <= 45) seasonalScore = 95  // 黄金窗口期
        else if (daysUntil > 45 && daysUntil <= 90) seasonalScore = 75  // 提前备货
        else if (daysUntil < 15 && daysUntil >= 0) seasonalScore = 40   // 来不及了
        else seasonalScore = 30
      }

      // 版权风险评分（越低风险，评分越高）
      const riskScore = copyrightRisk === 'LOW' ? 95 : copyrightRisk === 'MEDIUM' ? 50 : 10

      // 加权综合评分
      const weights = { demand: 0.2, competition: 0.2, profit: 0.25, cultural: 0.15, seasonal: 0.1, risk: 0.1 }
      const totalScore = Math.round(
        demandScore * weights.demand +
        competitionScore * weights.competition +
        profitScore * weights.profit +
        culturalScore * weights.cultural +
        seasonalScore * weights.seasonal +
        riskScore * weights.risk
      )

      let grade = 'D'
      if (totalScore >= 85) grade = 'A+'
      else if (totalScore >= 75) grade = 'A'
      else if (totalScore >= 65) grade = 'B+'
      else if (totalScore >= 55) grade = 'B'
      else if (totalScore >= 45) grade = 'C'

      let recommendation = 'SKIP'
      if (totalScore >= 75 && profitMargin >= 30 && copyrightRisk !== 'HIGH') recommendation = 'STRONGLY_RECOMMEND'
      else if (totalScore >= 60 && profitMargin >= 25) recommendation = 'RECOMMEND'
      else if (totalScore >= 45) recommendation = 'CAUTIOUS'

      const keyRisks: string[] = []
      if (profitMargin < 25) keyRisks.push(`利润率偏低（${profitMargin}%），建议优化定价或降低成本`)
      if (competitors > 500) keyRisks.push(`竞品数量多（${competitors}个），需明确差异化策略`)
      if (copyrightRisk === 'HIGH') keyRisks.push('版权风险高，请务必在发布前咨询律师')
      if (copyrightRisk === 'MEDIUM') keyRisks.push('存在一定版权风险，建议自创设计或购买授权')
      if (daysUntil !== undefined && daysUntil < 15) keyRisks.push('距节日不足 15 天，上架时间窗口紧张')

      const keyAdvantages: string[] = []
      if (profitMargin >= 45) keyAdvantages.push(`利润率优秀（${profitMargin}%）`)
      if (competitors < 100) keyAdvantages.push(`竞争较少（${competitors}个），有市场空间`)
      if (culturalFit === 'HIGH') keyAdvantages.push('文化适配度高，俄罗斯消费者接受度强')
      if (daysUntil !== undefined && daysUntil >= 15 && daysUntil <= 45) keyAdvantages.push('处于节日销售黄金窗口期')

      return JSON.stringify({
        design_name: name,
        total_score: totalScore,
        grade,
        recommendation,
        dimension_scores: {
          demand: demandScore,
          competition: competitionScore,
          profit: profitScore,
          cultural_fit: culturalScore,
          seasonality: seasonalScore,
          copyright_risk: riskScore
        },
        key_risks: keyRisks,
        key_advantages: keyAdvantages,
        auto_reject: profitMargin < 15 || copyrightRisk === 'HIGH'
      }, null, 2)
    }
  }
}

/** 生成 Markdown 格式 POD 选品报告，保存到 ~/OzonPOD-Research/reports/ */
const generatePodReportDef: LocalToolDefinition = {
  tool: {
    name: localTool('generate_pod_report'),
    description:
      '将多个 POD 设计方向的评分结果汇总，生成 Markdown 格式选品报告文件，保存到 ~/OzonPOD-Research/reports/ 目录。',
    inputSchema: {
      type: 'object',
      properties: {
        report_title: { type: 'string', description: '报告标题' },
        designs: {
          type: 'array',
          description: '设计评分结果数组，每项为 local_pod_design_scorer 的输出对象',
          items: { type: 'object' }
        },
        profit_data: {
          type: 'array',
          description: '利润计算结果数组，每项为 local_ozon_profit_calculator 的输出对象（可选，与 designs 对应）',
          items: { type: 'object' }
        },
        notes: { type: 'string', description: '附加备注（可选）' }
      },
      required: ['report_title', 'designs']
    }
  },
  executor: {
    async execute(args) {
      const title = args.report_title as string
      const designs = args.designs as any[]
      const profitData = (args.profit_data as any[]) ?? []
      const notes = (args.notes as string) ?? ''

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const monthStr = dateStr.slice(0, 7)

      const reportDir = join(homedir(), 'OzonPOD-Research', 'reports', monthStr)
      if (!existsSync(reportDir)) await mkdir(reportDir, { recursive: true })

      const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-')}_${dateStr}.md`
      const filePath = join(reportDir, filename)

      const sortedDesigns = [...designs].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))

      let md = `# ${title}\n\n`
      md += `**生成日期**：${dateStr}  \n**设计方案数**：${designs.length}  \n**推荐方案数**：${designs.filter(d => d.recommendation === 'STRONGLY_RECOMMEND' || d.recommendation === 'RECOMMEND').length}\n\n`
      md += `---\n\n## 执行摘要\n\n`

      const recommended = sortedDesigns.filter(d => d.recommendation === 'STRONGLY_RECOMMEND' || d.recommendation === 'RECOMMEND')
      if (recommended.length > 0) {
        md += `推荐设计方向（按评分排序）：\n\n`
        recommended.forEach((d, i) => {
          md += `${i + 1}. **${d.design_name}**（评分 ${d.total_score}/100，${d.grade}）- ${d.recommendation}\n`
        })
      } else {
        md += '本次分析暂无强烈推荐的设计方向，建议调整目标品类或参数后重新分析。\n'
      }

      md += `\n---\n\n## 详细分析\n\n`

      sortedDesigns.forEach((d, i) => {
        const profit = profitData[designs.indexOf(d)]
        md += `### ${i + 1}. ${d.design_name}\n\n`
        md += `| 指标 | 数值 |\n|------|------|\n`
        md += `| 综合评分 | **${d.total_score}/100** (${d.grade}) |\n`
        md += `| 推荐结论 | ${d.recommendation} |\n`
        if (profit) {
          md += `| 利润率 | ${profit.profit_margin_pct}% |\n`
          md += `| 净利润/件 | ${profit.net_profit_rub} RUB ≈ ${profit.cny_equivalent} CNY |\n`
        }
        md += `| 竞争评分 | ${d.dimension_scores?.competition ?? '-'}/100 |\n`
        md += `| 文化适配 | ${d.dimension_scores?.cultural_fit ?? '-'}/100 |\n\n`

        if (d.key_advantages?.length > 0) {
          md += `**优势**：${d.key_advantages.join('；')}\n\n`
        }
        if (d.key_risks?.length > 0) {
          md += `**风险**：${d.key_risks.join('；')}\n\n`
        }
        md += '\n'
      })

      if (notes) {
        md += `---\n\n## 备注\n\n${notes}\n`
      }

      await writeFile(filePath, md, 'utf-8')
      return JSON.stringify({ success: true, file_path: filePath, report_title: title, designs_count: designs.length })
    }
  }
}

// ── AI 抠图工具 ──────────────────────────────────────────────

/** 单张图片 AI 抠图，输出透明背景 PNG */
const removeBackgroundDef: LocalToolDefinition = {
  tool: {
    name: localTool('remove_background'),
    description:
      '对单张图片进行 AI 抠图，移除背景并输出透明背景的 PNG 文件。使用本地模型处理，无需联网，数据不上传。支持 JPG/PNG/WebP 输入。',
    inputSchema: {
      type: 'object',
      properties: {
        input_path: { type: 'string', description: '源图片路径（支持 JPG/PNG/WebP）' },
        output_path: { type: 'string', description: '输出路径（可选，默认在同目录生成 _nobg.png 文件）' },
        model: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          description: '模型大小：small（快）/medium（平衡，默认）/large（质量最佳）'
        }
      },
      required: ['input_path']
    }
  },
  executor: {
    async execute(args) {
      const inputPath = resolvePath(args.input_path as string)
      if (!existsSync(inputPath)) return JSON.stringify({ success: false, error: `文件不存在: ${inputPath}` })

      const ext = extname(inputPath)
      const defaultOutput = join(dirname(inputPath), basename(inputPath, ext) + '_nobg.png')
      const outputPath = args.output_path ? resolvePath(args.output_path as string) : defaultOutput

      // 确保输出目录存在
      const outDir = dirname(outputPath)
      if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })

      const startTime = Date.now()
      try {
        // 动态引入，避免在不使用时加载大模型
        const { removeBackground } = await import('@imgly/background-removal-node')
        const { readFile: readFileFn, writeFile: writeFileFn } = await import('fs/promises')

        const imageBuffer = await readFileFn(inputPath)
        const blob = new Blob([imageBuffer])

        const modelOpt = (args.model as string) ?? 'medium'
        const resultBlob = await removeBackground(blob, {
          model: modelOpt as 'small' | 'medium' | 'large'
        })

        const arrayBuffer = await resultBlob.arrayBuffer()
        await writeFileFn(outputPath, Buffer.from(arrayBuffer))

        const processingTime = Date.now() - startTime
        const { statSync } = await import('fs')
        const fileSizeKb = Math.round(statSync(outputPath).size / 1024)

        return JSON.stringify({
          success: true,
          input_path: inputPath,
          output_path: outputPath,
          processing_time_ms: processingTime,
          file_size_kb: fileSizeKb
        })
      } catch (err) {
        return JSON.stringify({ success: false, error: (err as Error).message, input_path: inputPath })
      }
    }
  }
}

/** 批量 AI 抠图工具，处理整个目录，支持并发控制 */
const batchRemoveBackgroundDef: LocalToolDefinition = {
  tool: {
    name: localTool('batch_remove_background'),
    description:
      '批量对目录内的图片进行 AI 抠图，并行处理多张图片，输出透明背景 PNG。结果保存到输出目录。',
    inputSchema: {
      type: 'object',
      properties: {
        input_dir: { type: 'string', description: '源图片目录' },
        output_dir: { type: 'string', description: '输出目录（默认：input_dir 下的 nobg/ 子目录）' },
        model: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          description: '模型大小，默认 medium'
        },
        concurrency: {
          type: 'number',
          description: '并发处理数量，默认 2（防止内存溢出）'
        }
      },
      required: ['input_dir']
    }
  },
  executor: {
    async execute(args) {
      const inputDir = resolvePath(args.input_dir as string)
      if (!existsSync(inputDir)) return JSON.stringify({ success: false, error: `目录不存在: ${inputDir}` })

      const outputDir = args.output_dir ? resolvePath(args.output_dir as string) : join(inputDir, 'nobg')
      if (!existsSync(outputDir)) await mkdir(outputDir, { recursive: true })

      const concurrency = (args.concurrency as number) ?? 2
      const modelOpt = (args.model as string) ?? 'medium'

      // 扫描支持的图片文件
      const entries = await readdir(inputDir, { withFileTypes: true })
      const imageFiles = entries
        .filter(e => e.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(e.name))
        .map(e => e.name)

      if (imageFiles.length === 0) {
        return JSON.stringify({ success: true, total: 0, message: '目录中没有找到图片文件' })
      }

      const { removeBackground } = await import('@imgly/background-removal-node')
      const { readFile: readFileFn, writeFile: writeFileFn } = await import('fs/promises')

      const startTime = Date.now()
      const results: object[] = []
      let succeeded = 0
      let failed = 0

      // 分批并发处理
      for (let i = 0; i < imageFiles.length; i += concurrency) {
        const batch = imageFiles.slice(i, i + concurrency)
        await Promise.all(batch.map(async (filename) => {
          const inputPath = join(inputDir, filename)
          const ext = extname(filename)
          const outputFilename = basename(filename, ext) + '_nobg.png'
          const outputPath = join(outputDir, outputFilename)

          try {
            const imageBuffer = await readFileFn(inputPath)
            const blob = new Blob([imageBuffer])
            const resultBlob = await removeBackground(blob, { model: modelOpt as 'small' | 'medium' | 'large' })
            const arrayBuffer = await resultBlob.arrayBuffer()
            await writeFileFn(outputPath, Buffer.from(arrayBuffer))
            succeeded++
            results.push({ filename, output: outputPath, status: 'success' })
          } catch (err) {
            failed++
            results.push({ filename, error: (err as Error).message, status: 'failed' })
          }
        }))
      }

      const totalTimeSec = Math.round((Date.now() - startTime) / 100) / 10
      return JSON.stringify({
        success: true, total: imageFiles.length, succeeded, failed,
        output_dir: outputDir, total_time_sec: totalTimeSec, results
      }, null, 2)
    }
  }
}

// ── SKU 生成工具 ──────────────────────────────────────────────

/** 根据设计 × 尺码 × 颜色矩阵生成 Ozon SKU 列表 */
const generateSkuMatrixDef: LocalToolDefinition = {
  tool: {
    name: localTool('generate_sku_matrix'),
    description:
      '根据设计 × 尺码 × 颜色的笛卡尔积生成 Ozon SKU 列表（JSON），offer_id 自动命名，输出可直接用于 Ozon API 上架的数据结构。',
    inputSchema: {
      type: 'object',
      properties: {
        design_code: { type: 'string', description: '设计编号，如 "DESIGN-001"，用于生成 offer_id' },
        design_name: { type: 'string', description: '商品名称基础（会拼接颜色和尺码）' },
        colors: {
          type: 'array',
          items: { type: 'string' },
          description: '颜色列表，如 ["BLACK", "WHITE", "RED"]'
        },
        sizes: {
          type: 'array',
          items: { type: 'string' },
          description: '尺码列表，如 ["XS", "S", "M", "L", "XL", "XXL"]，杯子/手机壳则传 ["ONE_SIZE"]'
        },
        base_price_rub: { type: 'number', description: '基础卢布售价' },
        ozon_category_id: { type: 'number', description: 'Ozon 分类 ID（需在 Ozon 卖家后台查询）' },
        color_attribute_id: { type: 'number', description: 'Ozon 颜色属性 ID（T恤通常为 10096）' },
        size_attribute_id: { type: 'number', description: 'Ozon 尺码属性 ID（T恤通常为 9384）' },
        color_value_map: {
          type: 'object',
          description: '颜色名称 → Ozon dictionary_value_id 映射，如 {"BLACK": 100048, "WHITE": 100049}',
          additionalProperties: { type: 'number' }
        },
        weight_g: { type: 'number', description: '商品重量（克），默认 300' },
        images_dir: { type: 'string', description: '抠图后图片目录（可选），用于自动关联图片文件名' },
        output_path: { type: 'string', description: '输出 JSON 文件路径（可选，默认保存到 ~/OzonPOD-Research/sessions/）' }
      },
      required: ['design_code', 'design_name', 'colors', 'sizes', 'base_price_rub', 'ozon_category_id']
    }
  },
  executor: {
    async execute(args) {
      const designCode = args.design_code as string
      const designName = args.design_name as string
      const colors = args.colors as string[]
      const sizes = args.sizes as string[]
      const basePrice = args.base_price_rub as number
      const categoryId = args.ozon_category_id as number
      const colorAttrId = (args.color_attribute_id as number) ?? 10096
      const sizeAttrId = (args.size_attribute_id as number) ?? 9384
      const colorValueMap = (args.color_value_map as Record<string, number>) ?? {}
      const weightG = (args.weight_g as number) ?? 300
      const imagesDir = args.images_dir ? resolvePath(args.images_dir as string) : null

      // 扫描图片目录（如果提供）
      let availableImages: string[] = []
      if (imagesDir && existsSync(imagesDir)) {
        const entries = await readdir(imagesDir)
        availableImages = entries.filter(e => /\.(jpg|jpeg|png|webp)$/i.test(e))
      }

      const skus: object[] = []
      for (const color of colors) {
        for (const size of sizes) {
          const offerId = `${designCode}-${color}-${size}`

          const attributes: object[] = []
          // 颜色属性
          const colorEntry: any = { complex_id: 0, id: colorAttrId, values: [] }
          if (colorValueMap[color]) {
            colorEntry.values.push({ dictionary_value_id: colorValueMap[color], value: color })
          } else {
            colorEntry.values.push({ value: color })
          }
          attributes.push(colorEntry)
          // 尺码属性
          attributes.push({ complex_id: 0, id: sizeAttrId, values: [{ value: size }] })

          // 自动匹配图片（按颜色名模糊匹配）
          const matchedImage = availableImages.find(img =>
            img.toLowerCase().includes(color.toLowerCase())
          ) ?? availableImages[0]

          skus.push({
            offer_id: offerId,
            name: `${designName} ${color} ${size}`,
            category_id: categoryId,
            price: String(basePrice),
            vat: '0.2',
            weight: weightG,
            weight_unit: 'g',
            dimension_unit: 'cm',
            width: 30, height: 40, depth: 5,
            images: matchedImage ? [{ file_name: matchedImage }] : [],
            attributes
          })
        }
      }

      const batchesNeeded = Math.ceil(skus.length / 100)

      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const monthStr = dateStr.slice(0, 7)
      const defaultOutputDir = join(homedir(), 'OzonPOD-Research', 'sessions', monthStr)
      if (!existsSync(defaultOutputDir)) await mkdir(defaultOutputDir, { recursive: true })

      const outputPath = args.output_path
        ? resolvePath(args.output_path as string)
        : join(defaultOutputDir, `${designCode}_skus_${dateStr}.json`)

      const payload = { design_code: designCode, design_name: designName, generated_at: dateStr, total_count: skus.length, batches_needed: batchesNeeded, items: skus }
      await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8')

      return JSON.stringify({
        success: true, total_count: skus.length, batches_needed: batchesNeeded,
        colors_count: colors.length, sizes_count: sizes.length,
        output_path: outputPath,
        offer_id_example: skus.length > 0 ? (skus[0] as any).offer_id : '',
        note: '请使用 local_create_ozon_products 工具将此 JSON 文件批量上架到 Ozon（需要 Ozon API Key）'
      })
    }
  }
}

/** 保存 SKU 配置模板，供下次复用 */
const saveSkuConfigDef: LocalToolDefinition = {
  tool: {
    name: localTool('save_sku_config'),
    description: '将 SKU 生成配置（颜色/尺码/价格/分类 ID 等）保存为模板文件，方便下次直接复用，避免重复输入。',
    inputSchema: {
      type: 'object',
      properties: {
        template_name: { type: 'string', description: '模板名称，如 "tshirt-standard"' },
        config: { type: 'object', description: 'SKU 配置对象（local_generate_sku_matrix 的参数）' }
      },
      required: ['template_name', 'config']
    }
  },
  executor: {
    async execute(args) {
      const templateName = args.template_name as string
      const config = args.config as object

      const configDir = join(homedir(), 'OzonPOD-Research', 'templates')
      if (!existsSync(configDir)) await mkdir(configDir, { recursive: true })

      const filePath = join(configDir, `${templateName}.json`)
      await writeFile(filePath, JSON.stringify({ template_name: templateName, created_at: new Date().toISOString(), config }, null, 2), 'utf-8')

      return JSON.stringify({ success: true, template_name: templateName, file_path: filePath })
    }
  }
}

/** 所有本地工具定义列表 */
const LOCAL_TOOLS: LocalToolDefinition[] = [
  readFileDef,
  writeFileDef,
  listDirectoryDef,
  shellExecuteDef,
  // Ozon POD 选品分析工具
  ozonProfitCalculatorDef,
  russianHolidayCalendarDef,
  podDesignScorerDef,
  generatePodReportDef,
  // AI 抠图工具
  removeBackgroundDef,
  batchRemoveBackgroundDef,
  // SKU 生成工具
  generateSkuMatrixDef,
  saveSkuConfigDef
]

/** 工具名称 -> 执行器的快速查找 Map */
const executorMap = new Map(LOCAL_TOOLS.map((def) => [def.tool.name, def.executor]))

/** 获取所有本地工具的 MCPTool 定义列表 */
export function getLocalTools(): MCPTool[] {
  return LOCAL_TOOLS.map((def) => def.tool)
}

/** 根据工具名称获取对应的执行器 */
export function getLocalToolExecutor(toolName: string): LocalToolExecutor | undefined {
  return executorMap.get(toolName)
}

/** 解析路径：支持 ~ 展开为用户主目录，其余使用 resolve 转为绝对路径 */
function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1))
  }
  return resolve(inputPath)
}
