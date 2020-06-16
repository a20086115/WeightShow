const cloud = require('wx-server-sdk')
const rq = require('request-promise')
const APPID = 'wx861848f2da1b88d0';
const APPSECRET = 'dd9bd641b13d0c6acdba6ad6cc89f663';
const COLLNAME = 'publicField';
const FIELDNAME = 'd6a66296-cc14-4405-a177-208939644eb1'
const baiduAccessToken = 'baiduAccessToken'
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    let res = await rq({
      method: 'GET',
      uri: "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + APPID + "&secret=" + APPSECRET,
    });
    res = JSON.parse(res)

    console.log(res.access_token)
    let resUpdate = await db.collection(COLLNAME).doc(FIELDNAME).update({
      data: {
        token: res.access_token,
        date: new Date()
      }
    })

    let baiduRes = await rq({
      method: 'POST',
      uri: "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=" + "TjtsElFUKTB3PL7BwHHoCyhO" + "&client_secret=" + "20uGTM5TcCEBRP0dHB8zu1q6H9ifqsZu",
    });
    baiduRes = JSON.parse(baiduRes)

    await db.collection(COLLNAME).doc(baiduAccessToken).update({
      data: {
        access_token: baiduRes.access_token,
        date: new Date()
      }
    })

  } catch (e) {
    console.error(e)
  }
}
