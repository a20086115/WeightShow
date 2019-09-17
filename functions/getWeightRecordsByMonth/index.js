const cloud = require('wx-server-sdk')
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
        date: _.and(_.gte(month + "-01"), _.lte(month + "-31")),
        openId: openId
      })
      .orderBy('date', 'asc')
      .get()

  } catch (e) {
    console.error(e)
  }
}