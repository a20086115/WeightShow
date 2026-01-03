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
    // 云函数运行在 UTC 时区，需要转换为中国时间（UTC+8）
    const utcNow = dayjs();
    const chinaTime = utcNow.add(8, "hour");
    var date = chinaTime.format("YYYY-MM-DD HH:mm");
    var today = chinaTime.format("YYYY-MM-DD");
    console.log('当前UTC时间:', utcNow.format("YYYY-MM-DD HH:mm"));
    console.log('转换后的中国时间:', date);
    console.log('查询日期:', today);
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
        // 使用 await 等待推送发送完成，并捕获错误
        try {
          await sendMessage(subscribe.openId, page, msgData, "-ejtsE73bMY5DzlafJoQvPxhkOUklQUP_hZGIMLWzXA")
          console.log(`推送已发送 [${subscribe.openId}], 日期: ${today}`)
        } catch (err) {
          console.error(`推送发送失败 [${subscribe.openId}]:`, err)
          // 继续处理下一个，不中断整个流程
        }
      } else {
        console.log(`用户已打卡，跳过推送 [${subscribe.openId}], 日期: ${today}`)
      }
    }
  } catch (err) {
    return err
  }
}

/**
 * 发送推送
 * @param {string} OPENID - 用户openId
 * @param {string} PAGE - 跳转页面
 * @param {object} DATA - 消息数据
 * @param {string} TEMPLATE_ID - 模板ID
 * @returns {Promise} 返回发送结果
 */
async function sendMessage(OPENID, PAGE, DATA, TEMPLATE_ID){
  try {
    const res = await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      page: PAGE,
      lang: 'zh_CN',
      data: DATA,
      templateId: TEMPLATE_ID,
      miniprogramState: 'formal'  // 跳转小程序类型：developer为开发版；trial为体验版；formal为正式版；默认为正式版
    })
    console.log("推送发送成功:", {
      openId: OPENID,
      result: res
    })
    return res
  } catch (err) {
    console.error("推送发送失败:", {
      openId: OPENID,
      error: err
    })
    throw err  // 重新抛出错误，让调用者处理
  }
}