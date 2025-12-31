/**
 * 云函数入口文件
 * @description 向指定表中插入一条数据
 */
const cloud = require('wx-server-sdk');

cloud.init();
const db = cloud.database();

// 计算连续打卡天数
function calculateContinuousDays(dates, checkInDate) {
  if (!dates || dates.length === 0) return 0
  
  // 去重并确保日期格式为 YYYY-MM-DD
  const uniqueDates = [...new Set(dates.map(date => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date
    }
    const d = new Date(date)
    if (isNaN(d.getTime())) return null
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }).filter(d => d !== null))]
  
  if (uniqueDates.length === 0) return 0
  
  // 确保当前打卡日期在列表中
  if (!uniqueDates.includes(checkInDate)) {
    uniqueDates.push(checkInDate)
  }
  
  // 排序（降序，最新的在前）
  uniqueDates.sort((a, b) => b.localeCompare(a))
  
  // 从当前打卡日期往前推，计算连续天数
  let continuousDays = 1 // 当前日期算1天
  let checkDate = checkInDate
  
  // 计算前一天的日期
  const getPrevDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const prevDate = new Date(year, month - 1, day - 1)
    const prevYear = prevDate.getFullYear()
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0')
    const prevDay = String(prevDate.getDate()).padStart(2, '0')
    return `${prevYear}-${prevMonth}-${prevDay}`
  }
  
  // 从当前日期往前推，检查连续天数
  let prevDate = getPrevDate(checkDate)
  while (uniqueDates.includes(prevDate)) {
    continuousDays++
    prevDate = getPrevDate(prevDate)
    
    // 防止无限循环（最多检查365天）
    if (continuousDays > 365) break
  }
  
  return continuousDays
}

// 更新用户的连续打卡天数
async function updateUserContinuousDays(db, openId, checkInDate) {
  try {
    // 分批查询用户的所有打卡日期（微信云开发单次最多返回100条）
    const MAX_LIMIT = 100
    let allDates = []
    let hasMore = true
    let skip = 0
    
    while (hasMore) {
      const records = await db.collection('records')
        .where({
          openId: openId
        })
        .field({
          date: true
        })
        .orderBy('date', 'desc')
        .skip(skip)
        .limit(MAX_LIMIT)
        .get()
      
      if (records.data.length > 0) {
        allDates = allDates.concat(records.data.map(r => r.date))
        skip += records.data.length
        
        // 如果返回的数据少于限制数量，说明已经查询完所有数据
        if (records.data.length < MAX_LIMIT) {
          hasMore = false
        }
        
        // 最多查询400条（足够计算连续打卡，因为连续打卡最多365天）
        if (allDates.length >= 400) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }
    
    // 计算连续打卡天数
    const continuousDays = calculateContinuousDays(allDates, checkInDate)
    
    // 更新用户信息
    await db.collection('users')
      .where({
        openId: openId
      })
      .update({
        data: {
          continuousDays: continuousDays,
          lastCheckInDate: checkInDate
        }
      })
    
    console.log(`[${openId}] 更新连续打卡天数: ${continuousDays}, 最后打卡日期: ${checkInDate}`)
  } catch (error) {
    console.error(`更新用户连续打卡天数失败 [${openId}]:`, error)
    throw error
  }
}

/**
 * 云函数主入口
 * @param {object} event - 事件对象
 * @param {object} context - 上下文对象
 * @returns {Promise<object>} 插入结果
 */
exports.main = async (event, context) => {
  try {
    const { userInfo = {}, tbName, data = {} } = event;
    const openId = userInfo.openId;

    // 参数校验
    if (!tbName) {
      throw new Error('表名不能为空');
    }
    if (!openId) {
      throw new Error('用户未授权');
    }

    // 设置默认字段
    const insertData = {
      ...data,
      openId: openId,
      createdate: new Date()
    };

    // 特殊处理：records表的weight字段
    if (tbName === 'records' && insertData.weight) {
      insertData.weight = parseFloat(insertData.weight);
      if (isNaN(insertData.weight)) {
        throw new Error('体重数据格式错误');
      }
    }

    // 执行插入
    const result = await db.collection(tbName).add({
      data: insertData
    });

    // 如果是插入records记录，更新用户的连续打卡天数
    if (tbName === 'records' && insertData.date) {
      try {
        await updateUserContinuousDays(db, openId, insertData.date);
      } catch (error) {
        console.error('更新连续打卡天数失败:', error);
        // 不影响插入操作，只记录错误
      }
    }

    return result;
  } catch (error) {
    console.error('insert云函数执行失败:', error);
    return {
      errMsg: error.message || '插入失败',
      errCode: -1
    };
  }
};