const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
})

const db = cloud.database()
const _ = db.command
const REPORT_COLLECTION = 'monthlyReports'
const RECORD_PAGE_SIZE = 1000

let aiInstance = null
try {
  const tcb = require('@cloudbase/node-sdk')
  const app = tcb.init({
    env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
  })
  aiInstance = app.ai()
} catch (error) {
  console.warn('AI 初始化失败，将使用兜底报告:', error.message)
}

function pad(num) {
  return String(num).padStart(2, '0')
}

function getCurrentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function getCurrentYear() {
  return String(new Date().getFullYear())
}

function toNumber(value) {
  const num = parseFloat(value)
  return Number.isFinite(num) ? num : null
}

function round(value, digits = 1) {
  const num = toNumber(value)
  if (num === null) return null
  return Number(num.toFixed(digits))
}

function formatNumber(value, digits = 1) {
  const num = toNumber(value)
  if (num === null) return '--'
  return Number.isInteger(num) ? String(num) : num.toFixed(digits)
}

function normalizeMonth(month) {
  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) return month
  return getCurrentMonth()
}

function getMonthLabel(month) {
  return `${month.slice(0, 4)}年${month.slice(5, 7)}月`
}

function normalizeYear(year) {
  if (typeof year === 'string' && /^\d{4}$/.test(year)) return year
  if (typeof year === 'number' && year >= 2000 && year <= 2100) return String(year)
  return getCurrentYear()
}

function normalizeScope(event = {}) {
  if (event.scope === 'year') return 'year'
  if (event.scope === 'all') return 'all'
  return 'month'
}

function normalizeReportStyle(event = {}) {
  if (event.style === 'encourage' || event.reportStyle === 'encourage') {
    return { value: 'encourage', label: '鼓励', prompt: '语气温暖、积极、像教练一样鼓励用户，坚持指出事实但多给信心。' }
  }
  if (event.style === 'roast' || event.reportStyle === 'roast') {
    return { value: 'roast', label: '毒嘴', prompt: '语气要更犀利、更直接，像严格但关心人的损友教练。可以吐槽偷懒、拖延、反复横跳、三天热度等行为，用短句、反问和辛辣比喻戳破借口；但必须基于数据，保持善意，不羞辱外貌、不做人身攻击、不制造焦虑。' }
  }
  return { value: 'professional', label: '专业', prompt: '语气专业、克制、清晰，像严谨的数据分析师。' }
}

function getReportContext(event = {}) {
  const scope = normalizeScope(event)
  const month = normalizeMonth(event.month)
  const year = normalizeYear(event.year || (month ? month.slice(0, 4) : ''))
  const reportStyle = normalizeReportStyle(event)
  if (scope === 'year') {
    return {
      scope,
      reportStyle: reportStyle.value,
      reportStyleLabel: reportStyle.label,
      reportStylePrompt: reportStyle.prompt,
      month,
      year,
      reportKey: `year:${year}:${reportStyle.value}`,
      periodLabel: `${year}年`,
      periodName: '年度',
      actionTitle: '下一阶段行动',
      confidenceBaseDays: 60
    }
  }
  if (scope === 'all') {
    return {
      scope,
      reportStyle: reportStyle.value,
      reportStyleLabel: reportStyle.label,
      reportStylePrompt: reportStyle.prompt,
      month,
      year,
      reportKey: `all:${reportStyle.value}`,
      periodLabel: '全部记录',
      periodName: '历史',
      actionTitle: '长期行动',
      confidenceBaseDays: 90
    }
  }
  return {
    scope,
    reportStyle: reportStyle.value,
    reportStyleLabel: reportStyle.label,
    reportStylePrompt: reportStyle.prompt,
    month,
    year: month.slice(0, 4),
    reportKey: `month:${month}:${reportStyle.value}`,
    periodLabel: getMonthLabel(month),
    periodName: '月度',
    actionTitle: '下月行动',
    confidenceBaseDays: 10
  }
}

function getWeekdayStats(records) {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const stats = names.map((name) => ({ name, count: 0 }))
  records.forEach((record) => {
    const index = new Date(String(record.date).replace(/-/g, '/')).getDay()
    stats[index].count += 1
  })
  return stats
}

function getLongestStreak(records) {
  const dates = [...new Set(records.map((item) => item.date))].sort()
  if (!dates.length) return 0
  let longest = 1
  let current = 1
  for (let index = 1; index < dates.length; index += 1) {
    const prev = new Date(dates[index - 1].replace(/-/g, '/'))
    const currentDate = new Date(dates[index].replace(/-/g, '/'))
    const diffDays = Math.round((currentDate - prev) / 86400000)
    if (diffDays === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }
  return longest
}

function buildMonthStats(records) {
  const monthMap = {}
  records.forEach((record) => {
    const month = String(record.date).slice(0, 7)
    if (!monthMap[month]) monthMap[month] = []
    monthMap[month].push(record)
  })
  return Object.keys(monthMap).sort().map((month) => {
    const monthRecords = monthMap[month]
      .filter((item) => toNumber(item.weight) !== null)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const weights = monthRecords.map((item) => toNumber(item.weight))
    const first = weights[0] || null
    const latest = weights.length ? weights[weights.length - 1] : null
    return {
      month,
      checkinDays: monthRecords.length,
      firstWeight: round(first, 1),
      latestWeight: round(latest, 1),
      weightChange: weights.length > 1 ? round(latest - first, 1) : null
    }
  })
}

function buildMetrics(context, userInfo, records) {
  const weightRecords = records
    .filter((item) => toNumber(item.weight) !== null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const weights = weightRecords.map((item) => toNumber(item.weight))
  const first = weights[0] || null
  const latest = weights.length ? weights[weights.length - 1] : null
  const min = weights.length ? Math.min(...weights) : null
  const max = weights.length ? Math.max(...weights) : null
  const weightChange = weights.length > 1 ? round(latest - first, 1) : null
  const aimWeight = toNumber(userInfo && userInfo.aimWeight)
  const targetDistance = latest !== null && aimWeight !== null ? round(latest - aimWeight, 1) : null
  const height = toNumber(userInfo && userInfo.height)
  const latestBmi = latest !== null && height ? round(latest / 2 / (height * height / 10000), 2) : null

  return {
    scope: context.scope,
    month: context.month,
    year: context.year,
    reportKey: context.reportKey,
    periodLabel: context.periodLabel,
    periodName: context.periodName,
    reportStyle: context.reportStyle,
    reportStyleLabel: context.reportStyleLabel,
    reportStylePrompt: context.reportStylePrompt,
    confidenceBaseDays: context.confidenceBaseDays,
    checkinDays: weightRecords.length,
    firstWeight: round(first, 1),
    latestWeight: round(latest, 1),
    minWeight: round(min, 1),
    maxWeight: round(max, 1),
    weightChange,
    aimWeight: round(aimWeight, 1),
    targetDistance,
    latestBmi,
    longestStreak: getLongestStreak(weightRecords),
    weekdayStats: getWeekdayStats(weightRecords),
    monthStats: buildMonthStats(weightRecords),
    records: weightRecords.map((item) => ({
      date: item.date,
      weight: round(item.weight, 1)
    }))
  }
}

function getDirection(change) {
  if (change === null) return 'unknown'
  if (change < -0.3) return 'down'
  if (change > 0.3) return 'up'
  return 'flat'
}

function buildFallbackReport(metrics, source = 'fallback') {
  const change = metrics.weightChange
  const direction = getDirection(change)
  const hasRecords = metrics.checkinDays > 0
  const changeText = change === null ? '暂无变化' : `${change > 0 ? '+' : ''}${formatNumber(change)}斤`
  const tag = direction === 'down' ? '趋势不错' : direction === 'up' ? '注意波动' : hasRecords ? '保持观察' : '等待记录'
  const summary = hasRecords
    ? `${metrics.periodLabel}共记录 ${metrics.checkinDays} 天，体重变化 ${changeText}，最新体重 ${formatNumber(metrics.latestWeight)} 斤。`
    : `${metrics.periodLabel}还没有可分析的体重记录，先完成几次打卡后报告会更有价值。`
  const periodTitle = metrics.scope === 'month' ? '本月体重报告' : `${metrics.periodName}体重报告`

  return {
    version: '1.0',
    month: metrics.month,
    year: metrics.year,
    scope: metrics.scope,
    reportKey: metrics.reportKey,
    periodLabel: metrics.periodLabel,
    periodName: metrics.periodName,
    reportStyle: metrics.reportStyle,
    reportStyleLabel: metrics.reportStyleLabel,
    confidence: metrics.checkinDays >= Math.max(10, metrics.confidenceBaseDays || 10) ? 'medium' : 'low',
    source,
    overview: {
      title: hasRecords ? periodTitle : '暂无可分析数据',
      summary,
      tag,
      score: Math.min(100, Math.round((metrics.checkinDays / Math.max(10, metrics.confidenceBaseDays || 30)) * 70) + Math.min(30, metrics.longestStreak * 4))
    },
    metrics: {
      checkinDays: metrics.checkinDays,
      weightChange: metrics.weightChange,
      latestWeight: metrics.latestWeight,
      minWeight: metrics.minWeight,
      maxWeight: metrics.maxWeight,
      targetDistance: metrics.targetDistance
    },
    trend: {
      direction,
      volatility: metrics.maxWeight !== null && metrics.minWeight !== null && metrics.maxWeight - metrics.minWeight > 6 ? 'high' : 'medium',
      description: direction === 'down'
        ? `${metrics.periodName}体重整体向下，说明当前执行方式已有正向反馈。`
        : direction === 'up'
          ? `${metrics.periodName}体重有上行波动，建议回看饮食、作息和运动是否被打断。`
          : `${metrics.periodName}体重整体较平稳，可以继续观察细微变化。`,
      highlights: [
        metrics.longestStreak >= 7 ? `最长连续记录 ${metrics.longestStreak} 天，记录习惯不错。` : '记录连续性还可以继续提升。',
        metrics.targetDistance !== null ? `距离目标体重 ${formatNumber(Math.abs(metrics.targetDistance))} 斤。` : '尚未设置目标体重。'
      ]
    },
    habit: {
      summary: metrics.checkinDays >= 15 ? `${metrics.periodName}记录频率较好，数据具备参考价值。` : `${metrics.periodName}记录次数偏少，建议先提升记录完整度。`,
      weekdayInsight: getWeekdayInsight(metrics.weekdayStats),
      suggestion: '建议固定早晨空腹称重，减少饮食和水分带来的误差。'
    },
    insights: [
      {
        type: direction === 'up' ? 'warning' : 'positive',
        title: tag,
        content: summary
      },
      {
        type: metrics.checkinDays >= 10 ? 'positive' : 'warning',
        title: '记录完整度',
        content: metrics.checkinDays >= 10 ? '记录次数已能支撑基础分析。' : '记录偏少，单次波动会影响判断。'
      }
    ],
    nextActions: [
      metrics.scope === 'month' ? '下月先完成连续 7 天记录' : '下一阶段先完成连续 7 天记录',
      '固定每天同一时间称重',
      direction === 'up' ? '优先减少晚间加餐，稳定睡眠' : '保持当前节奏，不要过度压缩饮食'
    ],
    encouragement: direction === 'down'
      ? '你已经用记录看见了变化，接下来继续把节奏稳住。'
      : '不用急着证明自己，先把每天的记录留下来。',
    share: {
      title: `${metrics.periodLabel} AI${metrics.periodName}报告`,
      summary
    }
  }
}

function getWeekdayInsight(weekdayStats) {
  const sorted = [...weekdayStats].sort((a, b) => b.count - a.count)
  if (!sorted.length || sorted[0].count === 0) return '暂无明显的星期打卡规律。'
  const best = sorted[0]
  const weak = [...weekdayStats].filter((item) => item.count === 0).map((item) => item.name)
  if (weak.length) return `${best.name}记录最多，${weak.slice(0, 2).join('、')}容易漏记。`
  return `${best.name}记录最多，本月各星期都有记录。`
}

function buildPrompt(metrics) {
  return `你是一个体重管理小程序的 AI${metrics.periodName}报告助手。请根据用户真实打卡数据，生成具体、有风格、非医疗诊断的中文${metrics.periodName}报告。

要求：
1. 只能输出 JSON，不要 markdown，不要解释。
2. 必须严格符合给定字段结构。
3. 不要编造不存在的数据；数据不足时要降低 confidence 并提醒记录偏少。
4. 建议必须具体、可执行，避免空话。
5. 不要承诺减肥效果，不做医疗建议。
6. weightChange 为负数代表体重下降。
7. 当前报告范围是：${metrics.periodLabel}，不要写成其他周期。
8. 当前报告风格是：${metrics.reportStyleLabel}。${metrics.reportStylePrompt}

返回 JSON 结构：
{
  "version": "1.0",
  "month": "YYYY-MM",
  "year": "YYYY",
  "scope": "month|year|all",
  "reportStyle": "professional|encourage|roast",
  "periodLabel": "",
  "confidence": "low|medium|high",
  "overview": { "title": "", "summary": "", "tag": "", "score": 0 },
  "metrics": { "checkinDays": 0, "weightChange": 0, "latestWeight": 0, "minWeight": 0, "maxWeight": 0, "targetDistance": 0 },
  "trend": { "direction": "down|up|flat|volatile|unknown", "volatility": "low|medium|high", "description": "", "highlights": [] },
  "habit": { "summary": "", "weekdayInsight": "", "suggestion": "" },
  "insights": [{ "type": "positive|warning|neutral", "title": "", "content": "" }],
  "nextActions": [],
  "encouragement": "",
  "share": { "title": "", "summary": "" }
}

用户结构化数据：
${JSON.stringify(metrics, null, 2)}`
}

function extractJson(text) {
  if (!text) return null
  const cleaned = String(text).trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (error) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw error
  }
}

function normalizeAiReport(report, metrics) {
  const fallback = buildFallbackReport(metrics, 'fallback')
  const safe = report && typeof report === 'object' ? report : {}
  return {
    ...fallback,
    ...safe,
    source: 'ai',
    version: '1.0',
    month: metrics.month,
    year: metrics.year,
    scope: metrics.scope,
    reportKey: metrics.reportKey,
    periodLabel: metrics.periodLabel,
    periodName: metrics.periodName,
    reportStyle: metrics.reportStyle,
    reportStyleLabel: metrics.reportStyleLabel,
    metrics: {
      ...fallback.metrics,
      ...(safe.metrics || {}),
      checkinDays: metrics.checkinDays,
      weightChange: metrics.weightChange,
      latestWeight: metrics.latestWeight,
      minWeight: metrics.minWeight,
      maxWeight: metrics.maxWeight,
      targetDistance: metrics.targetDistance
    },
    overview: { ...fallback.overview, ...(safe.overview || {}) },
    trend: { ...fallback.trend, ...(safe.trend || {}) },
    habit: { ...fallback.habit, ...(safe.habit || {}) },
    insights: Array.isArray(safe.insights) && safe.insights.length ? safe.insights.slice(0, 4) : fallback.insights,
    nextActions: Array.isArray(safe.nextActions) && safe.nextActions.length ? safe.nextActions.slice(0, 4) : fallback.nextActions,
    share: { ...fallback.share, ...(safe.share || {}) }
  }
}

function stripPrivateReportDoc(doc) {
  if (!doc) return null
  return {
    _id: doc._id,
    month: doc.month,
    year: doc.year,
    scope: doc.scope,
    reportStyle: doc.reportStyle,
    reportStyleLabel: doc.reportStyleLabel,
    reportKey: doc.reportKey,
    periodLabel: doc.periodLabel,
    source: doc.source,
    report: doc.report,
    metrics: doc.metrics,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

async function getSharedReport(reportId) {
  if (!reportId) return null
  const res = await db.collection(REPORT_COLLECTION).doc(reportId).get()
  return stripPrivateReportDoc(res.data)
}

async function getCachedReport(openId, context) {
  let res = await db.collection(REPORT_COLLECTION)
    .where({ openId, reportKey: context.reportKey })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
  let cached = stripPrivateReportDoc((res.data || [])[0])
  if (!cached && context.reportStyle === 'professional') {
    const legacyKey = context.scope === 'month'
      ? `month:${context.month}`
      : context.scope === 'year'
        ? `year:${context.year}`
        : 'all'
    res = await db.collection(REPORT_COLLECTION)
      .where({ openId, reportKey: legacyKey })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()
    cached = stripPrivateReportDoc((res.data || [])[0])
  }
  if (!cached && context.scope === 'month') {
    res = await db.collection(REPORT_COLLECTION)
      .where({ openId, month: context.month })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()
    cached = stripPrivateReportDoc((res.data || [])[0])
  }
  return cached
}

async function saveReport(openId, context, report, metrics) {
  const data = {
    openId,
    month: context.month,
    year: context.year,
    scope: context.scope,
    reportStyle: context.reportStyle,
    reportStyleLabel: context.reportStyleLabel,
    reportKey: context.reportKey,
    periodLabel: context.periodLabel,
    source: report.source || 'ai',
    report,
    metrics,
    updatedAt: db.serverDate()
  }
  const oldRes = await db.collection(REPORT_COLLECTION)
    .where({ openId, reportKey: context.reportKey })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
  const old = (oldRes.data || [])[0]
  if (old && old._id) {
    await db.collection(REPORT_COLLECTION).doc(old._id).update({ data })
    return old._id
  }
  const addRes = await db.collection(REPORT_COLLECTION).add({
    data: {
      ...data,
      createdAt: db.serverDate()
    }
  })
  return addRes._id
}

async function fetchRecords(openId, context) {
  let where = { openId }
  if (context.scope === 'month') {
    where = {
      openId,
      date: _.and(_.gte(`${context.month}-01`), _.lte(`${context.month}-31`))
    }
  } else if (context.scope === 'year') {
    where = {
      openId,
      date: _.and(_.gte(`${context.year}-01-01`), _.lte(`${context.year}-12-31`))
    }
  }

  const records = []
  let skip = 0
  while (true) {
    const res = await db.collection('records')
      .where(where)
      .orderBy('date', 'asc')
      .skip(skip)
      .limit(RECORD_PAGE_SIZE)
      .get()
    const data = res.data || []
    records.push(...data)
    if (data.length < RECORD_PAGE_SIZE) break
    skip += RECORD_PAGE_SIZE
  }
  return records
}

async function generateAiReport(metrics) {
  if (!aiInstance) return buildFallbackReport(metrics, 'fallback')

  try {
    const model = aiInstance.createModel('hunyuan-v3')
    const result = await model.generateText({
      model: 'hy3-preview',
      messages: [
        {
          role: 'user',
          content: buildPrompt(metrics)
        }
      ],
      temperature: 0.4,
      max_tokens: 1200
    })

    const parsed = extractJson(result && result.text)
    return normalizeAiReport(parsed, metrics)
  } catch (error) {
    console.error('AI 报告生成失败，使用真实数据兜底:', error)
    return buildFallbackReport(metrics, 'fallback')
  }
}

exports.main = async (event) => {
  try {
    const openId = event.userInfo && event.userInfo.openId
    if (!openId) {
      return { ok: false, errCode: 'NO_OPENID', errMsg: '未获取到用户身份' }
    }

    const reportId = event.reportId || event.id
    if (reportId && !event.force) {
      const shared = await getSharedReport(reportId)
      if (shared && shared.report) {
        return {
          ok: true,
          source: 'saved',
          shared: true,
          reportId: shared._id,
          report: shared.report,
          metrics: shared.metrics
        }
      }
    }

    const context = getReportContext(event)
    if (!event.force) {
      const cached = await getCachedReport(openId, context)
      if (cached && cached.report) {
        return {
          ok: true,
          source: 'saved',
          shared: false,
          reportId: cached._id,
          report: cached.report,
          metrics: cached.metrics
        }
      }
    }

    const [userRes, recordsRes] = await Promise.all([
      db.collection('users').where({ openId }).limit(1).get(),
      fetchRecords(openId, context)
    ])

    const userInfo = (userRes.data && userRes.data[0]) || {}
    const records = (recordsRes || []).filter((item) => item && item.date && item.weight)
    const metrics = buildMetrics(context, userInfo, records)
    const report = await generateAiReport(metrics)
    const savedReportId = await saveReport(openId, context, report, metrics)

    return {
      ok: true,
      source: report.source || 'ai',
      shared: false,
      reportId: savedReportId,
      report,
      metrics
    }
  } catch (error) {
    console.error('generateMonthlyReport failed:', error)
    const context = getReportContext(event || {})
    const fallback = buildFallbackReport({
      ...context,
      checkinDays: 0,
      weightChange: null,
      latestWeight: null,
      minWeight: null,
      maxWeight: null,
      targetDistance: null,
      longestStreak: 0,
      weekdayStats: getWeekdayStats([]),
      records: []
    }, 'fallback')
    return {
      ok: false,
      source: 'fallback',
      errMsg: error.message || '报告生成失败',
      report: fallback
    }
  }
}
