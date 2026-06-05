const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV || 'release-ba24f3'
})

const db = cloud.database()
const _ = db.command
const REPORT_COLLECTION = 'monthlyReports'
const RECORD_PAGE_SIZE = 1000
// 报告生成逻辑版本号：升级 prompt/分析框架时递增，使旧缓存自然失效、自动重新生成
const REPORT_VERSION = 'v2'

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

/**
 * 获取报告风格配置（含 AI 温度与详细写作指令）
 */
function normalizeReportStyle(event = {}) {
  if (event.style === 'encourage' || event.reportStyle === 'encourage') {
    return {
      value: 'encourage',
      label: '鼓励',
      temperature: 0.75,
      prompt: `【鼓励模式 - 温暖教练】
你是用户最信任的减重教练，温暖但不敷衍。必须做到：
- 每个结论都引用具体数字（打卡天数、体重变化、连续天数、距离目标），让用户感到「被看见」
- 即使数据不好看，也要先肯定「愿意记录本身就是进步」，再温柔指出改进点
- 多用「你已经…」「接下来只要…」「离目标又近了一步」等赋能句式
- 把 setbacks 重新定义为「调整信号」而非失败
- overview.summary 要有感染力；encouragement 像写给朋友的手写信，50-80字
- 禁止空洞鸡汤（如「加油你一定行」），每条鼓励必须挂钩数据事实`
    }
  }
  if (event.style === 'roast' || event.reportStyle === 'roast') {
    return {
      value: 'roast',
      label: '毒舌',
      temperature: 0.92,
      prompt: `【毒舌模式 - 极度犀利损友】
你是嘴毒心硬的损友教练，说话要狠、要辣、要让人又气又想笑。必须做到：
- 全程保持毒舌人设，overview/trend/habit/insights/encouragement 全部都要带刺，不能中途变温柔
- 大量使用：反问句（「这打卡率，是打算靠意念减重？」）、辛辣比喻（「体重曲线比过山车还刺激」「打卡记录比相亲还随缘」）、短句暴击
- 精准吐槽数据暴露的问题：三天打鱼两天晒网、体重反复横跳、周末失踪、目标设了当摆设、涨了还自我安慰
- 可以讽刺拖延、偷懒、借口、意志力表演，但禁止羞辱外貌/身材/性别，禁止人身攻击和制造身材焦虑
- insights 至少 2 条 type=warning，标题要扎心（如「打卡率感人」「体重在玩你」）
- encouragement 也要毒舌收尾（如「下次别光看不练，数据可不会陪你演戏」），禁止突然煽情
- 毒舌程度参考：「这个月打卡才 X 天，这出勤率公司早把你开了」级别的犀利，但必须基于真实数据`
    }
  }
  return {
    value: 'professional',
    label: '专业',
    temperature: 0.55,
    prompt: `【专业模式 - 数据分析师】
你是严谨的健康数据分析师，像出具体检解读报告。必须做到：
- 全文用数据说话：引用具体数值、百分比、对比（首末体重、波动幅度、打卡完整度、最长/当前连续天数）
- 分析要有因果链：「因为打卡集中在周X → 导致周Y数据缺失 → 影响趋势判断准确性」
- trend.description 要拆解体重走势阶段（前期/中期/后期），指出波动是否与打卡密度相关
- habit 要量化：打卡率=打卡天数/周期天数，指出数据置信度限制
- insights 侧重模式识别：周期性波动、平台期、反弹风险、目标达成路径
- 语气克制、客观、无情绪煽动；建议具体可执行，带优先级
- 禁止鸡汤和调侃，用「数据显示」「从记录来看」「建议关注」等专业表述`
  }
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
      reportStyleTemperature: reportStyle.temperature,
      month,
      year,
      reportKey: `year:${year}:${reportStyle.value}:${REPORT_VERSION}`,
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
      reportStyleTemperature: reportStyle.temperature,
      month,
      year,
      reportKey: `all:${reportStyle.value}:${REPORT_VERSION}`,
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
    reportStyleTemperature: reportStyle.temperature,
    month,
    year: month.slice(0, 4),
    reportKey: `month:${month}:${reportStyle.value}:${REPORT_VERSION}`,
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

/**
 * 计算「当前」连续打卡天数：必须以今天或昨天为终点才算延续，否则视为已中断（返回 0）
 * @param {Array} records 打卡记录
 * @param {string} today 东八区今日日期 YYYY-MM-DD
 */
function getCurrentStreak(records, today) {
  const dates = [...new Set(records.map((item) => item.date))].sort().reverse()
  if (!dates.length) return 0
  const todayTime = new Date(today.replace(/-/g, '/')).getTime()
  const lastTime = new Date(dates[0].replace(/-/g, '/')).getTime()
  const gapFromToday = Math.round((todayTime - lastTime) / 86400000)
  // 最后一次打卡距今超过 1 天，连续记录已断
  if (gapFromToday > 1) return 0
  let streak = 1
  for (let index = 1; index < dates.length; index += 1) {
    const newer = new Date(dates[index - 1].replace(/-/g, '/'))
    const older = new Date(dates[index].replace(/-/g, '/'))
    const diffDays = Math.round((newer - older) / 86400000)
    if (diffDays === 1) {
      streak += 1
    } else {
      break
    }
  }
  return streak
}

/**
 * 获取东八区今日日期 YYYY-MM-DD
 */
function getTodayInCST() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * 计算两次打卡之间的最大间隔天数
 */
function getMaxGapDays(records) {
  const dates = [...new Set(records.map((item) => item.date))].sort()
  if (dates.length < 2) return 0
  let maxGap = 0
  for (let index = 1; index < dates.length; index += 1) {
    const prev = new Date(dates[index - 1].replace(/-/g, '/'))
    const currentDate = new Date(dates[index].replace(/-/g, '/'))
    const diffDays = Math.round((currentDate - prev) / 86400000) - 1
    maxGap = Math.max(maxGap, Math.max(0, diffDays))
  }
  return maxGap
}

/**
 * 获取周期内总天数（用于计算打卡完整度）
 */
function getPeriodDays(context, records) {
  if (context.scope === 'month') {
    const [year, month] = context.month.split('-').map(Number)
    return new Date(year, month, 0).getDate()
  }
  if (context.scope === 'year') {
    const year = Number(context.year)
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return isLeap ? 366 : 365
  }
  if (!records.length) return 0
  const dates = records.map((item) => item.date).sort()
  const first = new Date(dates[0].replace(/-/g, '/'))
  const last = new Date(dates[dates.length - 1].replace(/-/g, '/'))
  return Math.max(1, Math.round((last - first) / 86400000) + 1)
}

/**
 * 分析近期趋势：对比最近1/3时段与之前时段的体重变化
 */
function getRecentTrendAnalysis(records) {
  const weightRecords = records
    .filter((item) => toNumber(item.weight) !== null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  if (weightRecords.length < 4) {
    return { phase: 'insufficient', recentChange: null, earlierChange: null, description: '记录不足，暂无法拆分阶段趋势' }
  }
  const splitIndex = Math.max(2, Math.floor(weightRecords.length / 3))
  const earlier = weightRecords.slice(0, splitIndex)
  const recent = weightRecords.slice(-splitIndex)
  const earlierFirst = toNumber(earlier[0].weight)
  const earlierLast = toNumber(earlier[earlier.length - 1].weight)
  const recentFirst = toNumber(recent[0].weight)
  const recentLast = toNumber(recent[recent.length - 1].weight)
  const earlierChange = round(earlierLast - earlierFirst, 1)
  const recentChange = round(recentLast - recentFirst, 1)
  let phase = 'stable'
  if (recentChange !== null && recentChange < -0.3) phase = 'recent_down'
  else if (recentChange !== null && recentChange > 0.3) phase = 'recent_up'
  else if (earlierChange !== null && earlierChange < -0.3 && recentChange !== null && recentChange > 0.3) phase = 'rebound'
  else if (earlierChange !== null && earlierChange > 0.3 && recentChange !== null && recentChange < -0.3) phase = 'recovery'

  return {
    phase,
    recentChange,
    earlierChange,
    recentDays: recent.length,
    earlierDays: earlier.length,
    description: phase === 'recent_down'
      ? `近期${recent.length}次记录体重下降${formatNumber(Math.abs(recentChange))}斤，势头向好`
      : phase === 'recent_up'
        ? `近期${recent.length}次记录体重上升${formatNumber(recentChange)}斤，需关注`
        : phase === 'rebound'
          ? `前期下降后近期反弹${formatNumber(recentChange)}斤，典型平台期后回升`
          : phase === 'recovery'
            ? `前期上升后近期回落${formatNumber(Math.abs(recentChange))}斤，调整见效`
            : '近期与前期体重变化幅度均较小，整体平稳'
  }
}

/**
 * 计算体重波动指标
 */
function getVolatilityAnalysis(weights) {
  if (!weights.length) return { range: null, level: 'unknown', swingCount: 0 }
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = round(max - min, 1)
  let swingCount = 0
  for (let i = 2; i < weights.length; i += 1) {
    const prev = weights[i - 1] - weights[i - 2]
    const curr = weights[i] - weights[i - 1]
    if (prev * curr < 0) swingCount += 1
  }
  let level = 'low'
  if (range > 8 || swingCount >= 4) level = 'high'
  else if (range > 4 || swingCount >= 2) level = 'medium'
  return { range, level, swingCount }
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

  const periodDays = getPeriodDays(context, weightRecords)
  const checkinRate = periodDays > 0 ? round((weightRecords.length / periodDays) * 100, 1) : null
  const volatility = getVolatilityAnalysis(weights)
  const recentTrend = getRecentTrendAnalysis(weightRecords)
  const goalProgress = first !== null && aimWeight !== null && first !== aimWeight
    ? round(((first - latest) / (first - aimWeight)) * 100, 1)
    : null

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
    reportStyleTemperature: context.reportStyleTemperature,
    confidenceBaseDays: context.confidenceBaseDays,
    periodDays,
    checkinDays: weightRecords.length,
    checkinRate,
    firstWeight: round(first, 1),
    latestWeight: round(latest, 1),
    minWeight: round(min, 1),
    maxWeight: round(max, 1),
    weightChange,
    aimWeight: round(aimWeight, 1),
    targetDistance,
    goalProgress,
    latestBmi,
    longestStreak: getLongestStreak(weightRecords),
    currentStreak: getCurrentStreak(weightRecords, getTodayInCST()),
    maxGapDays: getMaxGapDays(weightRecords),
    volatility,
    recentTrend,
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

/**
 * 按报告风格生成兜底文案变体
 */
function getStyleFallbackCopy(metrics) {
  const change = metrics.weightChange
  const changeText = change === null ? '暂无变化' : `${change > 0 ? '+' : ''}${formatNumber(change)}斤`
  const rateText = metrics.checkinRate !== null ? `打卡率 ${formatNumber(metrics.checkinRate)}%` : ''
  const hasRecords = metrics.checkinDays > 0

  if (metrics.reportStyle === 'roast') {
    return {
      tag: change !== null && change > 0 ? '体重在报复你' : hasRecords ? '打卡率感人' : '空空如也',
      summary: hasRecords
        ? `${metrics.periodLabel}就打卡 ${metrics.checkinDays} 天？${rateText ? rateText + '，' : ''}体重${changeText}。这出勤率，连体重都懒得配合你演戏。`
        : `${metrics.periodLabel}一条记录都没有，是打算靠意念减重吗？`,
      trendDesc: change !== null && change > 0
        ? `体重往上飙了 ${formatNumber(change)} 斤，曲线比你的心意还飘忽。`
        : change !== null && change < 0
          ? `瘦了 ${formatNumber(Math.abs(change))} 斤，别急着嘚瑟，先看看打卡率配不配这成绩。`
          : `体重稳如老狗，打卡倒是挺会摸鱼。`,
      encouragement: '数据不会陪你演戏，下次别光看不练。',
      habitSummary: metrics.checkinDays >= 15
        ? `打卡 ${metrics.checkinDays} 天，勉强及格，但最长断档 ${metrics.maxGapDays || 0} 天，自律感忽高忽低。`
        : `才打卡 ${metrics.checkinDays} 天，这记录密度，分析结果你自己信吗？`
    }
  }
  if (metrics.reportStyle === 'encourage') {
    return {
      tag: change !== null && change < 0 ? '你在变好' : hasRecords ? '坚持就有光' : '从这里开始',
      summary: hasRecords
        ? `${metrics.periodLabel}你认真记录了 ${metrics.checkinDays} 天，体重变化 ${changeText}。每一次记录，都是你在为更好的自己投票。`
        : `${metrics.periodLabel}还没有记录，没关系，今天就是最适合开始的一天。`,
      trendDesc: change !== null && change < 0
        ? `体重下降了 ${formatNumber(Math.abs(change))} 斤，你的努力正在悄悄兑现。`
        : change !== null && change > 0
          ? `体重有 ${formatNumber(change)} 斤上行，这是身体在提醒你调整节奏，不是否定你的努力。`
          : `体重整体平稳，说明你已经找到了一个可持续的节律，继续保持。`,
      encouragement: '你不需要完美，只需要比昨天多坚持一点点。我相信你。',
      habitSummary: metrics.checkinDays >= 15
        ? `${metrics.checkinDays} 天的记录习惯很棒，连续打卡最长 ${metrics.longestStreak} 天，这是你最值得骄傲的资产。`
        : `已经打卡 ${metrics.checkinDays} 天，每多记录一天，报告就会更懂你一分。`
    }
  }
  return {
    tag: change !== null && change < 0 ? '趋势下行' : change !== null && change > 0 ? '趋势上行' : hasRecords ? '趋势平稳' : '数据不足',
    summary: hasRecords
      ? `${metrics.periodLabel}共记录 ${metrics.checkinDays} 天（${rateText || '打卡率待计算'}），体重变化 ${changeText}，最新 ${formatNumber(metrics.latestWeight)} 斤，波动幅度 ${formatNumber(metrics.volatility && metrics.volatility.range)} 斤。`
      : `${metrics.periodLabel}暂无可分析记录，建议先完成至少 7 天连续打卡以提升报告置信度。`,
    trendDesc: metrics.recentTrend ? metrics.recentTrend.description : '记录不足，暂无法拆分阶段趋势。',
    encouragement: '基于现有数据持续记录，将显著提升分析准确度。',
    habitSummary: metrics.checkinDays >= 15
      ? `打卡完整度 ${rateText || metrics.checkinDays + '天'}，数据具备中等置信度，最长连续 ${metrics.longestStreak} 天。`
      : `打卡 ${metrics.checkinDays} 天，数据完整度偏低，结论仅供参考。`
  }
}

function buildFallbackReport(metrics, source = 'fallback') {
  const change = metrics.weightChange
  const direction = getDirection(change)
  const hasRecords = metrics.checkinDays > 0
  const styleCopy = getStyleFallbackCopy(metrics)
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
      summary: styleCopy.summary,
      tag: styleCopy.tag,
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
      description: styleCopy.trendDesc,
      highlights: [
        metrics.longestStreak >= 7 ? `最长连续记录 ${metrics.longestStreak} 天，记录习惯不错。` : '记录连续性还可以继续提升。',
        metrics.targetDistance !== null ? `距离目标体重 ${formatNumber(Math.abs(metrics.targetDistance))} 斤。` : '尚未设置目标体重。'
      ]
    },
    habit: {
      summary: styleCopy.habitSummary,
      weekdayInsight: getWeekdayInsight(metrics.weekdayStats),
      suggestion: '建议固定早晨空腹称重，减少饮食和水分带来的误差。'
    },
    insights: [
      {
        type: direction === 'up' ? 'warning' : 'positive',
        title: styleCopy.tag,
        content: styleCopy.trendDesc
      },
      {
        type: metrics.checkinDays >= 10 ? 'positive' : 'warning',
        title: metrics.reportStyle === 'roast' ? '数据可信度堪忧' : '记录完整度',
        content: metrics.checkinDays >= 10
          ? (metrics.reportStyle === 'roast' ? `才 ${metrics.checkinDays} 天记录，勉强够写报告，但别指望多精准。` : '记录次数已能支撑基础分析。')
          : (metrics.reportStyle === 'roast' ? '记录这么少，分析结果比彩票还随机。' : '记录偏少，单次波动会影响判断。')
      },
      ...(metrics.recentTrend && metrics.recentTrend.phase !== 'insufficient' ? [{
        type: metrics.recentTrend.phase === 'recent_up' || metrics.recentTrend.phase === 'rebound' ? 'warning' : 'positive',
        title: metrics.reportStyle === 'roast' ? '近期走势' : '阶段趋势',
        content: metrics.recentTrend.description
      }] : [])
    ],
    nextActions: [
      metrics.scope === 'month' ? '下月先完成连续 7 天记录' : '下一阶段先完成连续 7 天记录',
      '固定每天同一时间称重',
      direction === 'up' ? '优先减少晚间加餐，稳定睡眠' : '保持当前节奏，不要过度压缩饮食'
    ],
    encouragement: styleCopy.encouragement,
    share: {
      title: `${metrics.periodLabel} AI${metrics.periodName}报告`,
      summary: styleCopy.summary
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
  return `你是体重管理小程序的 AI 深度解读专家。请基于用户真实打卡数据，生成一份有深度、有鲜明风格的中文${metrics.periodName}报告（非医疗诊断）。

## 报告风格（最高优先级，全文贯穿）
当前风格：${metrics.reportStyleLabel}（reportStyle=${metrics.reportStyle}）
${metrics.reportStylePrompt}

## 深度分析框架（必须逐项覆盖）
1. 【趋势拆解】结合 weightChange、recentTrend（近期vs前期）、volatility（波动幅度/方向切换次数），判断是持续下降、平台期、反弹还是剧烈波动
2. 【习惯诊断】结合 checkinDays、checkinRate、periodDays、longestStreak、currentStreak、maxGapDays、weekdayStats，指出记录规律和薄弱环节
3. 【目标进度】若有 aimWeight/targetDistance/goalProgress，量化离目标还有多远，按当前节奏预估
4. 【行为模式】从 monthStats 和 records 中发现：周末怠工、月初冲刺月末摆烂、体重-打卡相关性等
5. 【行动建议】nextActions 给 3 条按优先级排序的具体行动，必须可执行、可衡量

## 字段写作要求
- overview.summary：80-120字，开头就要体现风格，引用至少2个关键数据
- overview.tag：4-8字风格化标签（毒舌模式要扎心，鼓励模式要暖心，专业模式要精准）
- trend.description：60-100字，分阶段解读，引用 recentTrend 和 volatility
- trend.highlights：2-3条，每条引用具体数字
- habit.summary + habit.weekdayInsight：各30-60字，引用 weekdayStats 和打卡率
- habit.suggestion：1条具体可操作建议
- insights：必须 3-4 条，覆盖趋势/习惯/目标/风险中的至少3个维度，每条 content 40-80字
- nextActions：3条，带「本周/每天/下次」等时间锚点
- encouragement：40-80字，风格与全文一致（毒舌模式也要毒到底）
- share.summary：30-50字，适合朋友圈传播

## 硬性规则
1. 只输出 JSON，不要 markdown，不要任何解释文字
2. 不要编造数据；checkinDays < 5 时 confidence=low 并明确说明数据不足
3. weightChange 负数=体重下降；单位是「斤」
4. 报告范围固定为：${metrics.periodLabel}，periodLabel 字段填此值
5. 不做医疗建议，不承诺减肥效果
6. 三种风格报告放在一起应一眼可辨，禁止千篇一律

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

用户结构化数据（含预计算的 recentTrend、volatility、checkinRate、goalProgress 等）：
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
    insights: Array.isArray(safe.insights) && safe.insights.length ? safe.insights.slice(0, 5) : fallback.insights,
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
  // 仅按带版本号的 reportKey 精确匹配，旧版本（无 v2 后缀）报告不再命中，会自动重新生成
  const res = await db.collection(REPORT_COLLECTION)
    .where({ openId, reportKey: context.reportKey })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()
  return stripPrivateReportDoc((res.data || [])[0])
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

  const temperature = metrics.reportStyleTemperature
    || (metrics.reportStyle === 'roast' ? 0.92 : metrics.reportStyle === 'encourage' ? 0.75 : 0.55)

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
      temperature,
      max_tokens: 2400
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
