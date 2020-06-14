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
  // 默认查询本人openId, 如果参数中有openId, 则取参数的openId
  if(event.openId){
    openId = event.openId;
  }
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