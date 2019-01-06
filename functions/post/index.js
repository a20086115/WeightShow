// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  event.data._openid = event.userInfo.openId;
  try {
    // 先判断是否有该日期数据
    let day = await db.collection('datas').where({
      _openid: event.userInfo.openId,
      date: event.data.date
    }).get()

    if(day.data.length == 1){
      return {
        done: true
      }
    }

    // 从months集合中 获取是否已经存储过该月的信息
    // 未存储过 则创建信息
    // 存储过 重新计算月平均值
    let data = await db.collection('months').where({
      _openid: event.userInfo.openId,
      year_month: event.data.year_month
    }).get()
    let month = data.data;
    if(month.length == 0){
      await db.collection('months').add({
        data:{
          _openid: event.userInfo.openId,
          year_month: event.data.year_month,
          size: 1,
          avgWeight: event.data.weight
        }
      })
    }else{
      await db.collection('months').where({
        _openid: event.userInfo.openId,
        year_month: event.data.year_month
      }).update({
        data:{
          size: month[0].size + 1,
          avgWeight: ((parseFloat(month[0].avgWeight) + parseFloat(event.data.weight) / (month[0].size + 1)).toFixed(2))
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