const cloud = require('wx-server-sdk')
const templateMessage = require('templateMessage.js')
const dayjs = require ('dayjs')
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

    var time = dayjs().add(8,"hour").format("HH:mm")
    var date = dayjs().add(8, "hour").format("YYYY-MM-DD")

    // 清空一下过期formid
    if(time == "00:00"){
      var deleteDay = dayjs().subtract(7, "day").format("YYYY-MM-DD")

      var ss = db.collection("formids").where({
        createdate: db.command.lt(new Date(deleteDay))
      }).remove()
    }

    console.log(time)

    let usersRes = await db.collection("users").where({
      clockOpen: true,
      clockDate: time
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
        // 判断今天是否已经有数据
        let records = await db.collection("records").where({
          openId: openid,
          date: date
        }).get()
        console.log(records)
        if (records.data.length == 0 || !records.data[0].weight){
          formidArr.push(formid)
          let msgData = {
            "keyword1": {
              "value": "瘦身打卡助手提醒您"
            },
            "keyword2": {
              "value": "您今天还没有打卡哦~~"
            },
            "keyword3": {
              "value": time
            },
          };
          let page = "pages/index/index"
          await templateMessage.sendTemplateMsg(token, MSGID, msgData, openid, formid, page);
        }
      } 
    }

    let deleteCount = db.collection("formids").where({
      formid: db.command.in(formidArr)
    }).remove()

    console.log("删除" + deleteCount)

  } catch (e) {
    console.error(e)
  }
}