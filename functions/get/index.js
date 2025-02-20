const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
  let openId = event.userInfo.openId;
  let tbName = event.tbName; // 要查询的表名
  let query = event.query;  // 要查询的query条件
  // 如果openId为ture, 则把本人openId添加到查询条件
  if(query.openId === true){
    query.openId = openId
  }
  // 默认创建用户
  try {
    let res = await db.collection(tbName).where(query).get()
    // 如果是用户表且无数据，自动创建
    if (tbName === 'users' && res.data.length === 0) {
      return await createDefaultUser(openId)
    }
    console.log(res)
    return res
  } catch (e) {
    console.error(e)
  }
}

async function createDefaultUser(openId){
  const defaultUser = {
    openId,
    nickName: '微信用户(默认昵称)',
    avatarUrl: 'http://cdnjson.com/images/2025/02/19/132.jpg',
    createdate: new Date()
  }
  await db.collection('users').add({ data: defaultUser })

  return {
    data: [defaultUser]
  }
}