// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
    env: "release-ba24f3", // 需替换为实际使用环境 id
})
cloud.init()
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
//   let openId = event.userInfo.openId; // 调用人的openid
  let { beginDay = '2025-03-01', endDay = '2025-03-31' } = event; // 要查询的类型 0-day, 1-周， 2-月
  try {
    let datas =  await db.collection('records').aggregate()
      // 阶段1：筛选有效记录
      .match({
        date: _.and(_.gte(beginDay), _.lte(endDay)),
        weight: _.and(_.neq(0), _.neq(''),  _.exists(true))
      })
      // 阶段2：按用户分组处理
      .group({
        _id: '$openId',
        weights: $.push({ 
          weight: '$weight',
          date: '$date'
        }),
        firstRecord: $.first('$$ROOT'),
        lastRecord: $.last('$$ROOT')
      })
      // 阶段3：计算体重差值
      .addFields({
        reduce: $.subtract([
          '$firstRecord.weight',
          '$lastRecord.weight'
        ])
      })
      // 阶段4：过滤有效差值
      .match({
        reduce: _.and( _.gt(0), _.lte(30)), // 只显示减重成功的  减重大于30的忽略
      })

//       .lookup({
//         from: 'users',
//         let: { userId: '$_id' },
//         pipeline: $.pipeline()
//           .match(_.expr($.eq(['$openId', '$$userId'])))
//           .project({
//             nickName: 1,
//             avatarUrl: 1,
//             openId: 1
//           })
//           .done(),
//         as: 'userInfo'
//       })
//       // 阶段6：重组数据结构
//       .replaceRoot({
//         $mergeObjects: [
//           { $arrayElemAt: ['$userInfo', 0] },
//           {
//             recordsList: [{
//               reduce: '$reduce',
//               max: '$firstRecord.weight',
//               min: '$lastRecord.weight'
//             }]
//           }
//         ]
//       })
      // 阶段7：最终排序和过滤
      .sort({ 'reduce': -1 })
      // 阶段5：关联用户信息
     .lookup({
        from: 'users',
        localField: '_id',
        foreignField: 'openId',
        as: 'userInfo'
      })
      
      .unwind('$userInfo') 
      .project({
        _id: 1,
        openId: 1,
//         nickName: 1,
//         avatarUrl: 1,
        nickName: '$userInfo.nickName',
        avatarUrl: '$userInfo.avatarUrl',
        reduce: 1,
        weights: 1
      })
      .limit(50)
      .end()

    console.log(datas)
    // 为了适配前段数据结构  对数据进行调整
    datas.list.forEach(item => {
      item.recordsList = [ {
        reduce: item.reduce
      }]
    })

    return datas

  } catch (e) {
    console.error(e)
  }
}
