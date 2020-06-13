// 云函数 增删改查封装
const app = getApp();
import dayjs from './dayjs.min.js'

var ajax = function (name, data) {
  return new Promise(function (resolve, reject) {
    data.env = app.globalData.CLOUD_ENV;
    wx.showLoading({ title: '加载中...' })
    wx.cloud.callFunction({
      name: name,
      data: data
    }).then(function (e) {
      wx.hideLoading();
      resolve(e);
    }).catch((e) => {
      wx.hideLoading();
      wx.showToast({
        icon: 'none',
        title: '网络出小差了,请稍后再试...'
      })
      reject(e)
    })
  });
}

var cloud = {
  // 增
  insert: function (tbName, data) {
    data.createon = dayjs().format("YYYY-MM-DD HH:mm:ss");
    return ajax('insert',{
        "tbName": tbName, // 数据库表名
        "data": data // 要存储的内容
      })
  },
  // 删
  delete: function (tbName, query) {
    return ajax('delete',{
        tbName: tbName, // 数据库表名
        query: query // 查询条件
      })
  },
  update: function (tbName, query, data) {
    return ajax('update',{
        tbName: tbName, // 数据库表名
        query: query, // 查询条件
        data: data
      })
  },
  get: function (tbName, query) {
    return ajax('get',{
        tbName: tbName, // 数据库表名
        query: query // 查询条件
      })
  },
  list: function (tbName, query, page, size, field, order) {
    return ajax('list',{
        tbName: tbName, // 数据库表名
        query: query, // 查询条件
        page: page,
        size: size,
        field: field,
        order: order
      })
  },
  ajax: ajax
}
export { cloud };