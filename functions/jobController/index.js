const cloud = require('wx-server-sdk')
const templateMessage = require('templateMessage.js')
cloud.init()
const db = cloud.database()
const COLLNAME = 'publicField';
const FIELDNAME = 'd6a66296-cc14-4405-a177-208939644eb1'
const MSGID = "_oxRA9i9Hr97aglKTsGYy567kTCbK5M-d7mv0xOkAys"

// 根据表名和query对象查询数据
exports.main = async (event, context) => {

  // 从数据库中获取AccessToken
  let tokenRes = await db.collection(COLL_FIELD_NAME).doc(FIELD_NAME).get();
  let token = tokenRes.data.token; // access_token

  var h = new Date().getHours();
  var min = new Date().getMinutes();
  var time = h<10?"0" + h : h;
  if(min < 10){
    time = time + ":0" + min;  
  }else{
    time = time + ":" + min;  
  }
  try {
    let users = await db.collection("users").where({
      clockOpen: true,
      clockDate: time
    }).get()

    for(let user of users){
      let msgData = {
        "keyword1": {
          "value": "hahahha"
        },
        "keyword2": {
          "value": "你参与的抽奖活动正在开奖，点击查看中奖名单"
        },
      };

      let openid = 'user.formid';
      let formid = 'formid';
      templateMessage.sendTemplateMsg(token, MSGID, msgData, openid, formid, page);
    }
  } catch (e) {
    console.error(e)
  }
}