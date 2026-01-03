/*
 * @Author: YuWenqiang
 * @Date: 2021-06-16 18:36:43
 * @Description: 云函数 Promise 封装
 */
import dayjs from './dayjs.min.js';

const app = getApp();

/**
 * 通用云函数调用方法
 * @param {string} name - 云函数名称
 * @param {object} data - 请求数据
 * @param {boolean} hideLoading - 是否隐藏加载提示
 * @returns {Promise} 返回Promise对象
 */
const ajax = function (name, data, hideLoading) {
  return new Promise(function (resolve, reject) {
    if (!name) {
      console.error('ajax: 云函数名称不能为空');
      reject(new Error('云函数名称不能为空'));
      return;
    }

    // 添加环境变量（如果存在）
    if (app.globalData && app.globalData.CLOUD_ENV) {
      data.env = app.globalData.CLOUD_ENV;
    }

    if (!hideLoading) {
      wx.showLoading({ 
        title: '加载中...',
        mask: true
      });
    }

    wx.cloud.callFunction({
      name: name,
      data: data
    }).then((res) => {
      if (!hideLoading) {
        wx.hideLoading();
      }
      resolve(res);
    }).catch((err) => {
      if (!hideLoading) {
        wx.hideLoading();
      }
      console.error(`云函数 ${name} 调用失败:`, err);
      wx.showToast({
        icon: 'none',
        title: '网络出小差了,请稍后再试...',
        duration: 2000
      });
      reject(err);
    });
  });
};

/**
 * 云函数封装对象
 */
const cloud = {
  /**
   * 插入数据
   * @param {string} tbName - 数据库表名
   * @param {object} data - 要存储的内容
   * @returns {Promise}
   */
  insert: function (tbName, data) {
    if (!tbName || !data) {
      return Promise.reject(new Error('insert: 参数不完整'));
    }
    data.createon = dayjs().format("YYYY-MM-DD HH:mm:ss");
    return ajax('insert', {
      tbName: tbName,
      data: data
    });
  },

  /**
   * 删除数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @returns {Promise}
   */
  delete: function (tbName, query) {
    if (!tbName || !query) {
      return Promise.reject(new Error('delete: 参数不完整'));
    }
    return ajax('delete', {
      tbName: tbName,
      query: query
    });
  },

  /**
   * 更新数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @param {object} data - 要更新的数据
   * @returns {Promise}
   */
  update: function (tbName, query, data) {
    if (!tbName || !query || !data) {
      return Promise.reject(new Error('update: 参数不完整'));
    }
    return ajax('update', {
      tbName: tbName,
      query: query,
      data: data
    });
  },

  /**
   * 查询数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @returns {Promise}
   */
  get: function (tbName, query) {
    if (!tbName || !query) {
      return Promise.reject(new Error('get: 参数不完整'));
    }
    return ajax('get', {
      tbName: tbName,
      query: query
    });
  },

  /**
   * 分页查询数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @param {number} page - 页码
   * @param {number} size - 每页数量
   * @param {string} field - 排序字段
   * @param {string} order - 排序方式
   * @returns {Promise}
   */
  list: function (tbName, query, page, size, field, order) {
    if (!tbName || !query) {
      return Promise.reject(new Error('list: 参数不完整'));
    }
    return ajax('list', {
      tbName: tbName,
      query: query,
      page: page || 1,
      size: size || 10,
      field: field || '_id',
      order: order || 'desc'
    });
  },

  /**
   * 统计数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @returns {Promise}
   */
  count: function (tbName, query) {
    if (!tbName) {
      return Promise.reject(new Error('count: 参数不完整'));
    }
    return ajax('count', {
      tbName: tbName,
      query: query || {}
    });
  },

  /**
   * 通用云函数调用
   */
  ajax: ajax
};

export { cloud };