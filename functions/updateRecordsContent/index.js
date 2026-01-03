const cloud = require('wx-server-sdk')
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()
// 根据表名和query对象查询数据
exports.main = async (event, context) => {
    let openId = "ohl0o47kLZ0eBSt7Osp1uGNJUfFM";
    // 先取出集合记录总数
    const countResult = await db.collection('records').count()
    const total = countResult.total
    // 计算需分几次取
    const batchTimes = Math.ceil(total / 100)
    // 承载所有读操作的 promise 的数组
    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('records').field({
        _id: true,
        weight: true,
      }).skip(i * 100).limit(100).get()
      tasks.push(promise)
    }
    // 等待所有
    var d = (await Promise.all(tasks)).reduce((acc, cur) => {
      return {
        data: acc.data.concat(cur.data),
        errMsg: acc.errMsg,
      }
    })
    console.log(d.length)
    return;
    for(var item of d.data){
      if(item.weight){
        db.collection("records").where({
          _id: item._id
        }).update({
          data: {
            weight: parseFloat(item.weight)
          }
        })
      }
    }
    console.log(d.data.length)
    console.log(d.data)

}