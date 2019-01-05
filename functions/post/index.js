// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  console.log(event.data)
  event.data._openid = event.userInfo.openId;
  try {
    let data = await db.collection('months').where({
      _openid: event.userInfo.openId,
      year_month: event.data.year_month
    }).get()
    let month = data.data;
    console.log(month,"this is month")
    if(month.length == 0){
      console.log(2222222)
      await db.collection('months').add({
        data:{
          _openid: event.userInfo.openId,
          year_month: event.data.year_month,
          size: 1,
          avgWeight: event.data.weight
        }
      })
    }else{
      console.log(333333)
      await db.collection('months').where({
        _openid: event.userInfo.openId,
        year_month: event.data.year_month
      }).update({
        data:{
          size: month[0].size + 1,
          avgWeight: (month[0].avgWeight + event.data.weight) / (month[0].size + 1)
        }
      })
    }
    return await db.collection('datas').add({
      data: event.data
    })
  } catch (e) {
    console.error(e)
  }
}