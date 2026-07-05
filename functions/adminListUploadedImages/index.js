const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();
const _ = db.command;
const ADMIN_OPEN_IDS = ['ohl0o47kLZ0eBSt7Osp1uGNJUfFM'];
const IMAGE_FIELDS = ['fileid', 'imageId', 'image', 'imageUrl', 'fileID', 'fileId'];
const IMAGE_ARRAY_FIELDS = ['imageUrls', 'images'];

async function isAdmin(openId) {
  if (!openId) return false;
  if (ADMIN_OPEN_IDS.includes(openId)) return true;

  const res = await db.collection('users').where({ openId }).limit(1).get();
  const user = res.data && res.data[0];
  return !!(user && (user.isAdmin === true || user.role === 'admin'));
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isImageRef(value) {
  if (typeof value !== 'string') return false;
  if (!value) return false;
  if (value.indexOf('data:image') === 0) return false;
  if (value.length > 600) return false;
  return value.indexOf('cloud://') === 0 || value.indexOf('http://') === 0 || value.indexOf('https://') === 0;
}

function buildRecordQuery(event = {}) {
  const imageExistsQuery = _.or(
    IMAGE_FIELDS.map((field) => ({ [field]: _.exists(true) }))
      .concat(IMAGE_ARRAY_FIELDS.map((field) => ({ [field]: _.exists(true) })))
  );
  const conditions = [imageExistsQuery];

  if (event.openId) {
    conditions.push({ openId: String(event.openId).trim() });
  }

  if (event.datePrefix) {
    conditions.push({
      date: db.RegExp({
        regexp: `^${escapeRegExp(String(event.datePrefix).trim())}`,
        options: ''
      })
    });
  }

  return conditions.length === 1 ? conditions[0] : _.and(conditions);
}

function collectRecordImages(record, userMap) {
  const user = userMap[record.openId] || {};
  const base = {
    recordId: record._id || '',
    openId: record.openId || '',
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    dateText: record.date || '',
    weight: record.weight || ''
  };
  const images = [];

  IMAGE_FIELDS.forEach((field) => {
    const value = record[field];
    if (!isImageRef(value)) return;
    images.push({
      ...base,
      id: `${record._id || record.date}_${field}`,
      field,
      fileId: value,
      previewUrl: value
    });
  });

  IMAGE_ARRAY_FIELDS.forEach((field) => {
    const values = Array.isArray(record[field]) ? record[field] : [];
    values.forEach((value, index) => {
      if (!isImageRef(value)) return;
      images.push({
        ...base,
        id: `${record._id || record.date}_${field}_${index}`,
        field,
        fileId: value,
        previewUrl: value
      });
    });
  });

  return images;
}

async function getUserMap(records) {
  const openIds = Array.from(new Set(records.map((item) => item.openId).filter(Boolean)));
  if (!openIds.length) return {};

  const res = await db.collection('users')
    .where({ openId: _.in(openIds) })
    .field({ openId: true, nickName: true, avatarUrl: true })
    .limit(100)
    .get();
  const map = {};
  (res.data || []).forEach((user) => {
    map[user.openId] = user;
  });
  return map;
}

async function attachTempUrls(images) {
  const cloudImages = images.filter((item) => item.fileId && item.fileId.indexOf('cloud://') === 0);
  if (!cloudImages.length) return images;

  const res = await cloud.getTempFileURL({
    fileList: cloudImages.map((item) => item.fileId)
  });
  const urlMap = {};
  (res.fileList || []).forEach((item) => {
    urlMap[item.fileID] = item.tempFileURL || item.fileID;
  });

  return images.map((item) => ({
    ...item,
    previewUrl: urlMap[item.fileId] || item.previewUrl
  }));
}

exports.main = async (event = {}) => {
  const openId = cloud.getWXContext().OPENID;
  const page = Math.max(1, Number(event.page || 1));
  const size = Math.min(100, Math.max(1, Number(event.size || 100)));

  if (!(await isAdmin(openId))) {
    return { ok: false, errCode: 'NO_PERMISSION', errMsg: '无权限' };
  }

  const query = buildRecordQuery(event);
  const count = await db.collection('records').where(query).count();
  const res = await db.collection('records')
    .where(query)
    .orderBy('date', 'desc')
    .skip((page - 1) * size)
    .limit(size)
    .get();
  const records = res.data || [];
  const userMap = await getUserMap(records);
  const images = records.reduce((list, record) => list.concat(collectRecordImages(record, userMap)), []);
  const data = await attachTempUrls(images);

  return {
    ok: true,
    data,
    page,
    size,
    total: count.total,
    hasMore: page * size < count.total
  };
};
