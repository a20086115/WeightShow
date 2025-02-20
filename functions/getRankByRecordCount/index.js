/*
 * @Author: YuWenqiang
 * @Date: 2025-02-19 16:36:25
 * @Description: 带缓存的排行榜查询
 */
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command

// 缓存相关配置
const CACHE_CODE = 'rank_record_count'
const CACHE_HOURS = 4

// 获取records的次数， 取前一百名
exports.main = async (event, context) => {
  try {
    // 先查询缓存
    const cacheData = await db.collection('params').where({
      code: CACHE_CODE
    }).get()

    // 如果有缓存且未过期，直接返回缓存数据
    if (cacheData.data.length > 0) {
      const cache = cacheData.data[0]
      const now = new Date().getTime()
      const cacheTime = new Date(cache.updateTime).getTime()
      
      // 判断缓存是否在4小时内
      if (now - cacheTime < CACHE_HOURS * 60 * 60 * 1000) {
        console.log('返回缓存数据')
        return {
          list: cache.value
        }
      }
    }

    // 缓存不存在或已过期，重新查询
    console.log('重新查询排行榜')
    const result = await db.collection('records').aggregate()
      .group({
        _id: '$openId',
        totalCount: $.sum(1)
      })
      .sort({
        totalCount: -1
      })
      .limit(100)
      .lookup({
        from: 'users',
        localField: '_id',
        foreignField: 'openId',
        as: 'userInfo'
      })
      .unwind('$userInfo')
      .project({
        _id: 0,
        openId: '$_id',
        totalCount: 1,
        nickName: '$userInfo.nickName',
        avatarUrl: '$userInfo.avatarUrl',
      })
      .end()

    // 更新缓存
    const rankList = result.list
    if (cacheData.data.length > 0) {
      // 更新已存在的缓存
      await db.collection('params').where({
        code: CACHE_CODE
      }).update({
        data: {
          value: rankList,
          updateTime: db.serverDate()
        }
      })
    } else {
      // 创建新的缓存
      await db.collection('params').add({
        data: {
          code: CACHE_CODE,
          value: rankList,
          desc: '打卡次数排行榜缓存',
          updateTime: db.serverDate()
        }
      })
    }

    return {
      list: rankList
    }

  } catch (e) {
    console.error(e)
    return {
      code: -1,
      msg: e.message || '查询失败'
    }
  }
}
