const cloud = require('wx-server-sdk')
const templateMessage = require('templateMessage.js')
cloud.init()
const db = cloud.database()
const COLLNAME = 'publicField';
const FIELDNAME = 'd6a66296-cc14-4405-a177-208939644eb1'
const MSGID = "_oxRA9i9Hr97aglKTsGYy567kTCbK5M-d7mv0xOkAys"

// 根据表名和query对象查询数据
exports.main = async (event, context) => {


  try {

    // 从数据库中获取AccessToken
    let tokenRes = await db.collection(COLLNAME).doc(FIELDNAME).get();
    let token = tokenRes.data.token; // access_token

    var h = new Date().getHours();
    var min = new Date().getMinutes();
    var time = h < 10 ? "0" + h : h;
    if (min < 10) {
      time = time + ":0" + min;
    } else {
      time = time + ":" + min;
    }
    console.log(time)

    let usersRes = await db.collection("users").where({
      clockOpen: true,
      // clockDate: time
    }).get()
    console.log(usersRes)
    let users = usersRes.data;
    if(users.length == 0){
      return;
    }
    var openidArr = [];
    var formidArr = [];
    for(let user of users){
      openidArr.push(user.openId)
    }

    var formsRes = await db.collection("formids").where({
      openId: db.command.in(openidArr)
    }).get()

    console.log(formsRes)
    let forms = formsRes.data;
    var obj = {}
    for(let form of forms){
      obj[form.openId] = form.formid;
    }

    for(let user of users){
      let openid = user.openId;
      let formid = obj[openid];
      if(formid){
        formidArr.push(formid)
        let msgData = {
          "keyword1": {
            "value": "瘦身打卡助手"
          },
          "keyword2": {
            "value": "今天您还没来打卡哦~"
          },
          "keyword3": {
            "value": time
          },
        };
        let page = "pages/index/index"
        console.log("发送一个")
        await templateMessage.sendTemplateMsg(token, MSGID, msgData, openid, formid, page);
      } 
    }

    db.collection("formids").where({
      formid: db.command.in(formidArr)
    }).remove()

  } catch (e) {
    console.error(e)
  }
}