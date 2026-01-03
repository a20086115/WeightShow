const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
// 根据表名和query对象，data更新数据
exports.main = async (event, context) => {
  let tbName = event.tbName; // 要查询的表名
  let query = event.query;  // 要查询的query条件
  let data = event.data;  // 要更新的新对象

  // 如果openId为ture, 则把openId添加到查询条件
  if (query.openId === true) {
    query.openId = event.userInfo.openId;
  }
  try {
    let count = await db.collection(tbName).where(query).count();
    if(count.total == 0){
      data.openId = event.userInfo.openId;
      data.createdate = new Date();
      return await db.collection(tbName).add({
        data:data
      })
    }else{
      return await db.collection(tbName).where(query).update({
        data: data
      })
    }
  } catch (e) {
    console.error(e)
  }
}