const rp = require('request-promise');
const sendTemplateMsg = async (token, msgid, msgData, openid, formid, page) => {
  await rp({
    json: true,
    method: 'POST',
    uri: 'https://api.weixin.qq.com/cgi-bin/message/wxopen/template/send?access_token=' + token,
    body: {
      touser: openid,
      template_id: msgid,
      page: page,
      form_id: formid,
      data: msgData
    }
  }).then(res => {
  }).catch(err => {
    console.error(err)
  })
}
module.exports = {
  sendTemplateMsg: sendTemplateMsg,
}
