/*
 * @Author: YuWenqiang
 * @Date: 2025-01-XX
 * @Description: 连续打卡天数排行榜（从users表读取）
 */
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

// 获取连续打卡天数排行榜
exports.main = async (event, context) => {
  try {
    // 直接从users表查询，按连续打卡天数排序
    const result = await db.collection('users')
      .where({
        continuousDays: _.gt(0) // 只查询连续打卡天数大于0的用户
      })
      .field({
        openId: true,
        nickName: true,
        avatarUrl: true,
        continuousDays: true,
        lastCheckInDate: true
      })
      .orderBy('continuousDays', 'desc')
      .limit(100) // 取前100名
      .get()

    // 格式化返回数据
    const rankList = result.data.map(user => ({
      openId: user.openId,
      continuousDays: user.continuousDays || 0,
      nickName: user.nickName || '未知用户',
      avatarUrl: user.avatarUrl || ''
    })).filter(item => item.nickName !== '未知用户' || item.avatarUrl) // 过滤掉没有用户信息的

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
