// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
const MAX_LIMIT = 100
exports.main = async (event, context) => {

  // 先取出集合记录总数
  const countResult = await db.collection('datas').count()
  const total = countResult.total
  // 计算需分几次取
  const batchTimes = Math.ceil(total / 100)
  // 承载所有读操作的 promise 的数组
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection('datas').field({
      year_month: true
    }).orderBy("year_month","desc").skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
    tasks.push(promise)
  }
  // 等待所有
  let allData = null;
  if(tasks.length == 0){
      return null;
  }else{
    allData = (await Promise.all(tasks)).reduce((acc, cur) => ({
      data: acc.data.concat(cur.data),
      errMsg: acc.errMsg,
    }))
  }


  function distinct(arr) {
    let result = []
    let obj = {}
    for (let i of arr) {
      if (!obj[i.year_month]) {
        result.push(i.year_month)
        obj[i.year_month] = 1
      }
    }
    return result
  }
  
  const yearMonthArray = distinct(allData.data)
  const len = yearMonthArray.length;
  var datasTask = []
  for (let i = 0; i < len; i++) {
    const promise = db.collection('datas')
      .where({
        _openid: event.userInfo.openId, // 填入当前用户 openid
        year_month: yearMonthArray[i]
      })
      .orderBy("date", "desc").get()
    datasTask.push(promise)
  }

  return await Promise.all(datasTask)
}