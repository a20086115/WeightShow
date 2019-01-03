const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
exports.main = async (event, context) => {
  try {
    return await db.collection('datas').where({
      _openid: event.userInfo.openId, // 填入当前用户 openid
      })
      .skip(event.page * event.size - event.size) // 跳过结果集中的前 10 条，从第 11 条开始返回
      .limit(event.size) // 限制返回数量为 10 条
      .get()
  }catch (e) {
    console.error(e)
  }
}
