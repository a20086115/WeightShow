const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

/** 单次 .in() 数量限制（微信云开发建议不超过 20） */
const IN_QUERY_LIMIT = 31
/** 云数据库单次 get 上限 */
const PAGE_SIZE = 100

/**
 * 批量查询多人在某月的体重记录（一次请求替代 N 次轮询）
 * @param {string} event.month - 月份，如 "2025-01"
 * @param {string[]} event.openIds - 成员 openId 数组
 * @returns {Promise<{ data: Array }>} 与 getWeightRecordsByMonth 单次返回的 data 结构一致，但为按 openId 分组的列表
 */
exports.main = async (event, context) => {
  const month = event.month
  let openIds = event.openIds || []

  if (!month || !Array.isArray(openIds) || openIds.length === 0) {
    return { data: [], errMsg: 'month and openIds required' }
  }

  const dateStart = month + '-01'
  const dateEnd = month + '-31'

  try {
    const allData = []
    // 分批 openId，每批内批量查 records，满 PAGE_SIZE 则继续 skip 拉取
    for (let i = 0; i < openIds.length; i += IN_QUERY_LIMIT) {
      const chunk = openIds.slice(i, i + IN_QUERY_LIMIT)
      const where = {
        openId: _.in(chunk),
        date: _.and(_.gte(dateStart), _.lte(dateEnd))
      }
      let skip = 0
      while (true) {
        const res = await db.collection('records')
          .where(where)
          .orderBy('date', 'asc')
          .skip(skip)
          .limit(PAGE_SIZE)
          .get()
        if (res.data && res.data.length) {
          allData.push(...res.data)
        }
        if (!res.data || res.data.length < PAGE_SIZE) {
          break
        }
        skip += PAGE_SIZE
      }
    }
    return { data: allData, errMsg: 'ok' }
  } catch (e) {
    console.error('getWeightRecordsByMonthBatch error', e)
    return { data: [], errMsg: e.message || 'query failed' }
  }
}
