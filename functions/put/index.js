const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  try {
    return await db.collection('datas').where({
      _openid: event.userInfo.openId,
      date: event.data.date
    }).update({
      data: event.data
    })
  } catch (e) {
    console.error(e)
  }
}