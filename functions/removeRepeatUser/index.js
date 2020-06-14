// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const $ = db.command.aggregate
const _ = db.command
// 云函数入口函数
exports.main = async (event, context) => {
  let res = await db.collection('users').aggregate()
    .group({
      // 按 category 字段分组
      _id: '$openId',
      ids:  $.addToSet('$_id',),
      // 让输出的每组记录有一个 avgSales 字段，其值是组内所有记录的 sales 字段的平均值
      count: $.sum(1)
    })
    .match({
      count:_.neq(1)
    })
    .limit(100)
    .end()
    console.log(res)
  for(var user of res.list){
    for(var i = 1; i<user.count; i++){
      var id = user.ids[i];
      db.collection('users').doc(id).remove()
    }
  }
}