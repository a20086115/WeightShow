/**
 * 云函数 增删改查封装
 * @description 提供统一的云函数调用接口，支持回调函数和错误处理
 */
const cloud = {
  /**
   * 插入数据
   * @param {string} tbName - 数据库表名
   * @param {object} data - 要存储的内容
   * @param {function} cb - 成功回调函数
   * @param {function} errcb - 错误回调函数
   * @param {boolean} hide - 是否隐藏加载提示
   */
  insert: function(tbName, data, cb, errcb, hide) {
    if (!tbName || !data) {
      console.error('insert: 参数不完整', { tbName, data });
      return;
    }

    if (!hide) {
      wx.showLoading({
        title: '加载中...',
        icon: 'loading',
        mask: true
      });
    }

    wx.cloud.callFunction({
      name: 'insert',
      data: {
        tbName: tbName,
        data: data
      }
    }).then((res) => {
      wx.hideLoading();
      if (typeof cb === "function") {
        cb(res);
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('insert 失败:', err);
      wx.showToast({
        title: '网络出小差了,请重试...',
        icon: 'none',
        duration: 2000
      });
      if (typeof errcb === "function") {
        errcb(err);
      }
    });
  },
  /**
   * 删除数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @param {function} cb - 成功回调函数
   * @param {function} errcb - 错误回调函数
   */
  delete: function (tbName, query, cb, errcb) {
    if (!tbName || !query) {
      console.error('delete: 参数不完整', { tbName, query });
      return;
    }

    wx.showLoading({
      title: '加载中...',
      icon: 'loading',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'delete',
      data: {
        tbName: tbName,
        query: query
      }
    }).then((res) => {
      wx.hideLoading();
      if (typeof cb === "function") {
        cb(res);
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('delete 失败:', err);
      wx.showToast({
        title: '网络出小差了,请稍后再试...',
        icon: 'none',
        duration: 2000
      });
      if (typeof errcb === "function") {
        errcb(err);
      }
    });
  },
  /**
   * 更新数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @param {object} data - 要更新的数据
   * @param {function} cb - 成功回调函数
   * @param {function} errcb - 错误回调函数
   */
  update: function (tbName, query, data, cb, errcb) {
    if (!tbName || !query || !data) {
      console.error('update: 参数不完整', { tbName, query, data });
      return;
    }

    wx.showLoading({
      title: '加载中...',
      icon: 'loading',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'update',
      data: {
        tbName: tbName,
        query: query,
        data: data
      }
    }).then((res) => {
      wx.hideLoading();
      if (typeof cb === "function") {
        cb(res);
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('update 失败:', err);
      wx.showToast({
        title: '网络出小差了,请稍后再试...',
        icon: 'none',
        duration: 2000
      });
      if (typeof errcb === "function") {
        errcb(err);
      }
    });
  },
  /**
   * 查询数据
   * @param {string} tbName - 数据库表名
   * @param {object} query - 查询条件
   * @param {function} cb - 成功回调函数
   * @param {function} errcb - 错误回调函数
   * @param {boolean} hideError - 是否隐藏错误提示
   */
  get: function (tbName, query, cb, errcb, hideError) {
    if (!tbName || !query) {
      console.error('get: 参数不完整', { tbName, query });
      return;
    }

    wx.showLoading({
      title: '加载中...',
      icon: 'loading',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'get',
      data: {
        tbName: tbName,
        query: query
      }
    }).then((res) => {
      wx.hideLoading();
      if (typeof cb === "function") {
        cb(res);
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('get 失败:', err);
      if (!hideError) {
        wx.showToast({
          title: '网络出小差了,请稍后再试...',
          icon: 'none',
          duration: 2000
        });
      }
      if (typeof errcb === "function") {
        errcb(err);
      }
    });
  }
};

export { cloud };