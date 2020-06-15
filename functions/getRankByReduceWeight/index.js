// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
cloud.init()
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
  let openId = event.userInfo.openId; // 调用人的openid
  let {beginDay, endDay} = event; // 要查询的类型 0-day, 1-周， 2-月
  try {
    return await db.collection('users').aggregate()
    .lookup({
      from: 'records',
      let: {
        openId: '$openId'
      },
      pipeline: $.pipeline()
        .match({
          date: _.and(_.gte(beginDay), _.lte(endDay)),
          weight: _.neq(0),
        })
        .match(_.expr( $.eq(['$openId', '$$openId']),
        ))
        .project({
          _id: 1,
          weight: 1,  
          date: 1
        })
        .sort({
          date: 1
        })
        .group({
          _id: '$alias',
          max: $.first('$weight'),
          min: $.last('$weight'),
        })
        .addFields({
          reduce: $.subtract(['$max', '$min'])
        }) 
        .match({
          reduce: _.lt(30)
        })
        .done(),
      as: 'recordsList',
    })
    .sort({
      'recordsList.0.reduce': -1
    })
    .limit(100)
    .end()


    

  } catch (e) {
    console.error(e)
  }
}
