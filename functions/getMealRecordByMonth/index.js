const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
  let openId = event.userInfo.openId;
  let month = event.month; // 要查询的月份
  // 正常查询本人信息， 如果传有openid, 则查询该人的。
  if(event.openId){
    openId = event.openId;
  }
  try {
    return await db.collection('meal').aggregate()
    .match({
      date: _.and(_.gte(month + "-01"), _.lte(month + "-31")),
    })
    .group({
      _id: '$date',
      totalCalorie: $.sum('$calorie')
    })
    .end()
  } catch (e) {
    console.error(e)
  }
}