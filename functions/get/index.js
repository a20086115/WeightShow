const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const MAX_LIMIT = 100
exports.main = async (event, context) => {
  // 先取出该账号下的year_month总数
  const yearMonthResult = await db.collection('months').where({
    _openid: event.userInfo.openId
  }).orderBy("year_month", "desc").get()
  console.log("yearMonthResult", yearMonthResult)
  // 根据year_month数据集合，依次从数据库中取出数据
  const times = yearMonthResult.data.length;
  var tasks = []
  for (let i = 0; i < times; i++) {
    const promise = db.collection('datas')
      .where({
        _openid: event.userInfo.openId, // 填入当前用户 openid
        year_month: yearMonthResult.data[i].year_month
      })
      .orderBy("date", "desc").get()
    tasks.push(promise)
  }
  let result = await Promise.all(tasks)
  for(let index in result){
    result[index].data.year_month = yearMonthResult.data[index].year_month
  }
  console.log(result);
  // 等待所有
  return result
  // return (await Promise.all(tasks)).reduce((acc, cur) => ({
  //   data: acc.data.concat(cur.data),
  //   errMsg: acc.errMsg,
  // }))
}