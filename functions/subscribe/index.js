const cloud = require('wx-server-sdk')
cloud.init()
const dayjs = require ('dayjs')
const db = cloud.database()
exports.main = async (event, context) => {
  try {
    /**
     *  推送触发器
     * 1. 每分钟执行一次
     * 2. 检查对应时间 有无推送记录
     * 3. 发送推送
     *  */

     // 查找推送记录(加8适应时区问题)
    var date = dayjs().add(8, "hour").format("YYYY-MM-DD HH:mm")
    var today = dayjs().add(8, "hour").format("YYYY-MM-DD")
    console.log(date)
    let res = await db.collection("subscribe").where({
      subscribeDate: date
    }).get()
    let subcribesArray = res.data;
    console.log("找到记录数量：" + subcribesArray.length)
    for(let subscribe of subcribesArray){
        // 判断今天是否已经有数据
      let count = await db.collection("records").where({
        openId: subscribe.openId,
        date: today
      }).count()
      if(count.total == 0){
        let msgData = {
          "thing4": {
            "value": "每日瘦身打卡"
          },
          "thing5": {
            "value": "您今天还没打卡，记得要来打卡哦~"
          },
          "thing3": {
            "value": "感谢您的使用~"
          },
        };
        let page = "pages/start/index"
        sendMessage(subscribe.openId, page, msgData, "-ejtsE73bMY5DzlafJoQvPxhkOUklQUP_hZGIMLWzXA")
      }
    }
  } catch (err) {
    return err
  }
}

/**
 * 发送推送
 */
function sendMessage(OPENID, PAGE, DATA, TEMPLATE_ID){
  try {
    cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      page: PAGE,
      lang: 'zh_CN',
      data: DATA,
      templateId: TEMPLATE_ID,
      miniprogramState: 'formal'  // 跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
    }).then(res => {
      console.log(res)
    })
    console.log("发送了一条推送")
    console.log({
      touser: OPENID,
      page: PAGE,
      lang: 'zh_CN',
      data: DATA,
      templateId: TEMPLATE_ID,
      miniprogramState: 'formal'  // 跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
    })
    
  } catch (err) {
    
  }
}