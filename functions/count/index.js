/*
 * @Author: YuWenqiang
 * @Date: 2025-02-20 10:37:59
 * @Description: 
 * 
 */
// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  let tbName = event.tbName; // 要查询的表名
  let query = event.query;  // 要查询的query条件

  // 如果openId为true, 则把openId添加到查询条件
  if (query.openId === true) {
    query.openId = event.userInfo.openId
  }

  try {
    return await db.collection(tbName).where(query).count()
  } catch (e) {
    console.error(e)
  }
} 