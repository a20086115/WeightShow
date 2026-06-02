const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

function pad(num) {
  return String(num).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function formatChinaDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function getChinaToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function normalizeDate(value, fallback) {
  if (!value) return fallback
  const text = String(value).trim().replace(/\//g, '-')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback
}

function buildDateRows(startDate, endDate, dailyRows) {
  const byDate = {}
  dailyRows.forEach((row) => {
    byDate[row.date] = row
  })

  const result = []
  let cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (cursor <= end) {
    const date = formatDate(cursor)
    result.push(byDate[date] || {
      date,
      recordCount: 0,
      userCount: 0
    })
    cursor = addDays(cursor, 1)
  }

  return result
}

function buildDateList(startDate, endDate) {
  const result = []
  let cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (cursor <= end) {
    result.push(formatDate(cursor))
    cursor = addDays(cursor, 1)
  }

  return result
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0)
}

async function getCreatedDailyStats(startDate, endDate) {
  const dates = buildDateList(startDate, endDate)
  const rows = []

  for (const date of dates) {
    const start = new Date(`${date}T00:00:00+08:00`)
    const nextDate = formatDate(addDays(new Date(`${date}T00:00:00Z`), 1))
    const end = new Date(`${nextDate}T00:00:00+08:00`)
    const match = {
      createdate: _.and(_.gte(start), _.lt(end)),
      openId: _.exists(true),
      weight: _.nin(['', null])
    }

    const [recordRes, userRes] = await Promise.all([
      db.collection('records').where(match).count(),
      db.collection('records').aggregate()
        .match(match)
        .group({
          _id: '$openId'
        })
        .count('count')
        .end()
    ])

    rows.push({
      date,
      recordCount: recordRes.total || 0,
      userCount: userRes.list && userRes.list[0] ? userRes.list[0].count : 0
    })
  }

  return rows
}

exports.main = async (event = {}) => {
  const now = getChinaToday()
  const defaultEnd = formatChinaDate(now)
  const defaultStart = formatChinaDate(addDays(now, -29))
  const startDate = normalizeDate(event.startDate, defaultStart)
  const endDate = normalizeDate(event.endDate, defaultEnd)

  const match = {
    date: _.and(_.gte(startDate), _.lte(endDate)),
    openId: _.exists(true),
    weight: _.nin(['', null])
  }

  try {
    const dailyRes = await db.collection('records').aggregate()
      .match(match)
      .group({
        _id: {
          date: '$date',
          openId: '$openId'
        },
        recordCount: $.sum(1)
      })
      .group({
        _id: '$_id.date',
        recordCount: $.sum('$recordCount'),
        userCount: $.sum(1)
      })
      .sort({
        _id: 1
      })
      .project({
        _id: 0,
        date: '$_id',
        recordCount: 1,
        userCount: 1
      })
      .limit(1000)
      .end()

    const uniqueUserRes = await db.collection('records').aggregate()
      .match(match)
      .group({
        _id: '$openId'
      })
      .count('count')
      .end()

    const continuousThresholds = [1, 3, 7, 14, 30]
    const continuousPairs = await Promise.all(
      continuousThresholds.map(async (days) => {
        const res = await db.collection('users')
          .where({
            continuousDays: _.gte(days)
          })
          .count()
        return [days, res.total || 0]
      })
    )

    const topContinuousRes = await db.collection('users')
      .where({
        continuousDays: _.gt(0)
      })
      .field({
        openId: true,
        nickName: true,
        avatarUrl: true,
        continuousDays: true,
        lastCheckInDate: true
      })
      .orderBy('continuousDays', 'desc')
      .limit(20)
      .get()

    const daily = buildDateRows(startDate, endDate, dailyRes.list || [])
    const createdDaily = event.includeCreatedDate
      ? await getCreatedDailyStats(startDate, endDate)
      : []
    const days = daily.length || 1
    const totalRecords = sum(daily, 'recordCount')
    const totalDailyUsers = sum(daily, 'userCount')
    const totalCreatedRecords = sum(createdDaily, 'recordCount')
    const totalCreatedDailyUsers = sum(createdDaily, 'userCount')
    const activeCheckinUsers = uniqueUserRes.list && uniqueUserRes.list[0]
      ? uniqueUserRes.list[0].count
      : 0

    return {
      errCode: 0,
      range: {
        startDate,
        endDate,
        days
      },
      summary: {
        totalRecords,
        activeCheckinUsers,
        avgDailyRecords: Number((totalRecords / days).toFixed(2)),
        avgDailyUsers: Number((totalDailyUsers / days).toFixed(2)),
        totalCreatedRecords,
        avgDailyCreatedRecords: Number((totalCreatedRecords / days).toFixed(2)),
        avgDailyCreatedUsers: Number((totalCreatedDailyUsers / days).toFixed(2))
      },
      createdDaily,
      daily,
      continuous: {
        thresholds: Object.fromEntries(
          continuousPairs.map(([days, count]) => [`gte${days}`, count])
        ),
        topUsers: (topContinuousRes.data || []).map((user) => ({
          openId: user.openId,
          nickName: user.nickName || '',
          avatarUrl: user.avatarUrl || '',
          continuousDays: user.continuousDays || 0,
          lastCheckInDate: user.lastCheckInDate || ''
        }))
      }
    }
  } catch (error) {
    console.error('getCheckinStats failed', error)
    return {
      errCode: -1,
      errMsg: error.message || 'query failed'
    }
  }
}
