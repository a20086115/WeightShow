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
    return await db.collection('users').aggregate()
    .lookup({
      from: 'records',
      let: {
        openId: '$openId'
      },
      pipeline: $.pipeline()
          .match({
            weight: _.neq("")
          })
          .match({
            weight: _.neq(0)
          })
          .match(_.expr( $.eq(['$openId', '$$openId']),
          ))
          .project({
            _id: 1,
            weight: 1
          })
          .done(),
      as: 'recordList',
    })
    .addFields({
      totalCount: $.size('$recordList')
    }) 
    .sort({
      totalCount:-1
    })
    .limit(100)
    .end()

  } catch (e) {
    console.error(e)
  }
}
