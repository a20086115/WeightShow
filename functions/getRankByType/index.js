// 云函数入口文件
const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
const _ = db.command
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
  let openId = event.userInfo.openId; // 调用人的openid
  let type = event.type; // 要查询的类型 0-day, 1-周， 2-月
  try {
    return await db.collection('records')
      .where({
        _openid: 'user-open-id',
        done: false
      })
      .orderBy('_id', 'desc')
      .limit(12)
      .get()

  } catch (e) {
    console.error(e)
  }
}