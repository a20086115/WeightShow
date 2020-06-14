// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
    console.log("test")
    var res = await db.collection('users').aggregate()
    .lookup({
      from: 'records',
      let: {
        openId: '$openId'
      },
      pipeline: $.pipeline()
          .match({
            weightKg:_.exists(false),
          })
          .match(_.expr( $.eq(['$openId', '$$openId']),
          ))
          .project({
            _id: 1,
            weight: 1
          })
          .done(),
      as: 'bookList',
    })
    .addFields({
      totalCount: $.size('$bookList')
    }) 
    .match({
     totalCount:_.neq(0),
    })
    .sort({
      totalCount:-1
    })
    .limit(1000)
    .end()

    console.log(res)

  
    var users = res.list;
    for(var user of users){
      if(user.kgFlag === true){ // 开启kg单位
        for(var record of user.bookList){
          await db.collection("records").doc(record._id).update({
            data: {
              // 表示指示数据库将字段自增 10
              weight: parseFloat(record.weight || 0) * 2,
              weightKg: parseFloat(record.weight || 0)
            }
          })
        }

      }else if(user.kgFlag === false){
        for(var record of user.bookList){
          await db.collection("records").doc(record._id).update({
            data: {
              // 表示指示数据库将字段自增 10
              weight: parseFloat(record.weight || 0),
              weightKg: parseFloat((parseFloat(record.weight|| 0) / 2).toFixed(2))
            }
          })
        }
      }else{
        if(user.bookList.length > 0){
          var record = user.bookList[0];
          if(parseFloat(record.weight || 0) > 90){
            for(var record of user.bookList){
              await db.collection("records").doc(record._id).update({
                data: {
                  // 表示指示数据库将字段自增 10
                  weight: parseFloat(record.weight || 0),
                  weightKg: parseFloat((parseFloat(record.weight || 0) / 2).toFixed(2))
                }
              })
            }
          }else{
            for(var record of user.bookList){
              await db.collection("records").doc(record._id).update({
                data: {
                  // 表示指示数据库将字段自增 10
                  weight: parseFloat(record.weight || 0) * 2,
                  weightKg: parseFloat(record.weight || 0)
                }
              })
            }
          }
        }
      }
    }

    var records = await db.collection('records').aggregate()
    .match({
      weightKg:_.exists(false),
    })
    .limit(2500)
    .end()
    for(var record of records.list){
      if(parseFloat(record.weight || 0) > 90){
        await db.collection("records").doc(record._id).update({
          data: {
            // 表示指示数据库将字段自增 10
            weight: parseFloat(record.weight || 0),
            weightKg: parseFloat((parseFloat(record.weight || 0) / 2).toFixed(2))
          }
        })
      }else{
        await db.collection("records").doc(record._id).update({
          data: {
            // 表示指示数据库将字段自增 10
            weight: parseFloat(record.weight || 0) * 2,
            weightKg: parseFloat(record.weight || 0)
          }
        })
      }
    }
}