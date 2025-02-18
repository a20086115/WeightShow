// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
cloud.init()
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
// 获取records的次数， 取前一百名
exports.main = async (event, context) => {
  try {
    console.log(1)

    return await db.collection('records').aggregate()
      .group({
        _id: '$openId',
        totalCount: $.sum(1)
      })
      .sort({
        totalCount: -1
      })
      .limit(100)
      .lookup({
        from: 'users',
        localField: '_id',
        foreignField: 'openId',
        as: 'userInfo'
      })
      .unwind('$userInfo') 
      .project({
        _id: 0,
        openId: '$_id',
        totalCount: 1,
        // 从用户表带过来的字段，按需添加
        nickName: '$userInfo.nickName',
        avatarUrl: '$userInfo.avatarUrl',
        // 可以继续添加其他需要的用户字段...
      })
      .end()
  } catch (e) {
    console.error(e)
  }
}
