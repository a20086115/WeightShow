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
  const page = Math.max(1, Number(event.page || 1));
  const size = Math.min(100, Math.max(1, Number(event.size || 50)));

  if (!(await isAdmin(openId))) {
    return { ok: false, errCode: 'NO_PERMISSION', errMsg: '无权限' };
  }

  const count = await db.collection('params').count();
  const res = await db.collection('params')
    .orderBy('code', 'asc')
    .skip((page - 1) * size)
    .limit(size)
    .get();

  return {
    ok: true,
    data: res.data || [],
    page,
    size,
    total: count.total,
    hasMore: page * size < count.total
  };
};
