const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();
const ADMIN_OPEN_IDS = ['ohl0o47kLZ0eBSt7Osp1uGNJUfFM'];

async function isAdmin(openId) {
  if (!openId) return false;
  if (ADMIN_OPEN_IDS.includes(openId)) return true;

  const res = await db.collection('users').where({ openId }).limit(1).get();
  const user = res.data && res.data[0];
  return !!(user && (user.isAdmin === true || user.role === 'admin'));
}

exports.main = async (event = {}) => {
  const openId = cloud.getWXContext().OPENID;
  const { code, value } = event;

  if (!code || typeof code !== 'string') {
    return { ok: false, errCode: 'INVALID_PARAM', errMsg: '参数 code 不能为空' };
  }

  if (!(await isAdmin(openId))) {
    return { ok: false, errCode: 'NO_PERMISSION', errMsg: '无权限' };
  }

  const data = {
    code,
    value,
    updatedAt: new Date(),
    updatedBy: openId
  };
  const query = { code };
  const count = await db.collection('params').where(query).count();

  if (count.total === 0) {
    await db.collection('params').add({
      data: {
        ...data,
        createdAt: new Date()
      }
    });
  } else {
    await db.collection('params').where(query).update({ data });
  }

  return { ok: true, data };
};
