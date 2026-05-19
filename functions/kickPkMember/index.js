const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()

/**
 * 发起人移出 PK 成员
 * @param {string} event.pkId - PK 文档 _id
 * @param {string} event.targetOpenId - 被移出成员的 openId
 */
exports.main = async (event, context) => {
  const { pkId, targetOpenId } = event
  const callerOpenId = cloud.getWXContext().OPENID

  if (!pkId || !targetOpenId) {
    return { ok: false, errMsg: '参数不完整' }
  }
  if (targetOpenId === callerOpenId) {
    return { ok: false, errMsg: '不能移出自己' }
  }

  try {
    const pkRes = await db.collection('pk').doc(pkId).get()
    const pk = pkRes.data
    if (!pk) {
      return { ok: false, errMsg: 'PK 不存在' }
    }
    if (pk.openId !== callerOpenId) {
      return { ok: false, errMsg: '仅发起人可移出成员' }
    }

    const members = pk.members || []
    if (!members.some((m) => m.openId === targetOpenId)) {
      return { ok: false, errMsg: '该成员不在队伍中' }
    }

    const newMembers = members.filter((m) => m.openId !== targetOpenId)
    await db.collection('pk').doc(pkId).update({
      data: { members: newMembers }
    })

    return { ok: true, members: newMembers, errMsg: 'ok' }
  } catch (e) {
    console.error('kickPkMember error', e)
    return { ok: false, errMsg: e.message || '操作失败' }
  }
}
