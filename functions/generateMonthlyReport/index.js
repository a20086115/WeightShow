const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
})

const db = cloud.database()
const _ = db.command
const REPORT_COLLECTION = 'monthlyReports'

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

function buildMetrics(month, userInfo, records) {
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
    month,
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
    ? `本月共记录 ${metrics.checkinDays} 天，体重变化 ${changeText}，最新体重 ${formatNumber(metrics.latestWeight)} 斤。`
    : '本月还没有可分析的体重记录，先完成几次打卡后报告会更有价值。'

  return {
    version: '1.0',
    month: metrics.month,
    confidence: metrics.checkinDays >= 10 ? 'medium' : 'low',
    source,
    overview: {
      title: hasRecords ? '本月体重报告' : '暂无可分析数据',
      summary,
      tag,
      score: Math.min(100, Math.round((metrics.checkinDays / 30) * 70) + Math.min(30, metrics.longestStreak * 4))
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
        ? '本月体重整体向下，说明当前执行方式已有正向反馈。'
        : direction === 'up'
          ? '本月体重有上行波动，建议回看饮食、作息和运动是否被打断。'
          : '本月体重整体较平稳，可以继续观察细微变化。',
      highlights: [
        metrics.longestStreak >= 7 ? `最长连续记录 ${metrics.longestStreak} 天，记录习惯不错。` : '记录连续性还可以继续提升。',
        metrics.targetDistance !== null ? `距离目标体重 ${formatNumber(Math.abs(metrics.targetDistance))} 斤。` : '尚未设置目标体重。'
      ]
    },
    habit: {
      summary: metrics.checkinDays >= 15 ? '本月记录频率较好，数据具备参考价值。' : '本月记录次数偏少，建议先提升记录完整度。',
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
      '下月先完成连续 7 天记录',
      '固定每天同一时间称重',
      direction === 'up' ? '优先减少晚间加餐，稳定睡眠' : '保持当前节奏，不要过度压缩饮食'
    ],
    encouragement: direction === 'down'
      ? '你已经用记录看见了变化，接下来继续把节奏稳住。'
      : '不用急着证明自己，先把每天的记录留下来。',
    share: {
      title: `${metrics.month} AI 月度报告`,
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
  return `你是一个体重管理小程序的 AI 月度报告助手。请根据用户真实打卡数据，生成克制、具体、非医疗诊断的中文月度报告。

要求：
1. 只能输出 JSON，不要 markdown，不要解释。
2. 必须严格符合给定字段结构。
3. 不要编造不存在的数据；数据不足时要降低 confidence 并提醒记录偏少。
4. 建议必须具体、可执行，避免空话。
5. 不要承诺减肥效果，不做医疗建议。
6. weightChange 为负数代表体重下降。

返回 JSON 结构：
{
  "version": "1.0",
  "month": "YYYY-MM",
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

async function getCachedReport(openId, month) {
  const res = await db.collection(REPORT_COLLECTION)
    .where({ openId, month })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
  return stripPrivateReportDoc((res.data || [])[0])
}

async function saveReport(openId, month, report, metrics) {
  const data = {
    openId,
    month,
    source: report.source || 'ai',
    report,
    metrics,
    updatedAt: db.serverDate()
  }
  const oldRes = await db.collection(REPORT_COLLECTION)
    .where({ openId, month })
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
    console.error('AI 月报生成失败，使用真实数据兜底:', error)
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

    const month = normalizeMonth(event.month)
    if (!event.force) {
      const cached = await getCachedReport(openId, month)
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
      db.collection('records')
        .where({
          openId,
          date: _.and(_.gte(`${month}-01`), _.lte(`${month}-31`))
        })
        .orderBy('date', 'asc')
        .get()
    ])

    const userInfo = (userRes.data && userRes.data[0]) || {}
    const records = (recordsRes.data || []).filter((item) => item && item.date && item.weight)
    const metrics = buildMetrics(month, userInfo, records)
    const report = await generateAiReport(metrics)
    const savedReportId = await saveReport(openId, month, report, metrics)

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
    const month = normalizeMonth(event && event.month)
    const fallback = buildFallbackReport({
      month,
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
