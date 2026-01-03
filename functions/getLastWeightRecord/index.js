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
  let openId = event.userInfo.openId;
  let month = event.month; // 要查询的月份
  try {
    return await db.collection('records')
      .where({
        openId: openId
      })
      .orderBy('date', 'desc')
      .limit(1)
      .get()

  } catch (e) {
    console.error(e)
  }
}