/*
 * @Author: YuWenqiang
 * @Date: 2025-01-20
 * @Description: 机器人主界面
 */

const App = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    bindings: {
      personal: null,
      groups: []
    },
    isBound: false,
    bindMessage: '', // 绑定消息
    robotWechatId: 'webot222', // 机器人微信号，用于个人绑定引导
    userInfo: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      userInfo: App.globalData.userInfo || {}
    });
    this.loadBindings();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadBindings();
  },

  /**
   * 加载绑定信息
   */
  loadBindings: function () {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'robotManager',
      data: {
        action: 'getBindings'
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.errCode === 0) {
        const bindings = res.result.data;
        const isBound = !!(bindings.personal || (bindings.groups && bindings.groups.length > 0));
        
        // 生成绑定消息
        let bindMessage = '';
        if (this.data.userInfo._id) {
          bindMessage = `绑定：${this.data.userInfo._id}`;
        }
        
        this.setData({
          bindings: bindings,
          isBound: isBound,
          bindMessage: bindMessage
        });
      } else {
        wx.showToast({
          title: res.result?.errMsg || '加载失败',
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载绑定信息失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 复制机器人微信号
   */
  copyWechatId: function () {
    wx.setClipboardData({
      data: this.data.robotWechatId,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  /**
   * 一键复制绑定消息
   */
  copyBindMessage: function () {
    // 检查绑定消息是否存在
    let bindMessage = this.data.bindMessage;
    
    // 如果绑定消息为空，尝试重新生成
    if (!bindMessage && this.data.userInfo._id) {
      bindMessage = `绑定：${this.data.userInfo._id}`;
      this.setData({
        bindMessage: bindMessage
      });
    }
    
    if (!bindMessage) {
      console.error('绑定消息为空，userInfo:', this.data.userInfo);
      wx.showToast({
        title: '生成失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    console.log('准备复制绑定消息:', bindMessage);
    
    wx.setClipboardData({
      data: bindMessage,
      success: (res) => {
        console.log('复制成功:', res);
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (err) => {
        console.error('复制失败:', err);
        // 开发者工具中可能无法真正复制，提供备用方案
        const isDevTool = wx.getSystemInfoSync().platform === 'devtools';
        if (isDevTool) {
          wx.showModal({
            title: '开发者工具提示',
            content: `绑定消息：${bindMessage}\n\n开发者工具中无法复制到剪贴板，请手动复制上述消息。`,
            showCancel: false,
            confirmText: '知道了'
          });
        } else {
          wx.showToast({
            title: '复制失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      }
    });
  },

  /**
   * 管理个人绑定配置
   */
  managePersonalConfig: function () {
    if (!this.data.bindings.personal) {
      wx.showToast({
        title: '未找到绑定信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 严格检查 configId 是否存在且有效
    const configId = this.data.bindings.personal.configId;
    if (!configId || configId === 'undefined' || configId === 'null' || configId.trim() === '') {
      wx.showToast({
        title: '配置ID不存在，请重新绑定',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查 targetId 是否存在
    if (!this.data.bindings.personal.targetId) {
      wx.showToast({
        title: '目标ID不存在',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/robot/config?type=friend&targetId=${this.data.bindings.personal.targetId}&configId=${configId}`
    });
  },

  /**
   * 管理群聊绑定配置
   */
  manageGroupConfig: function (e) {
    const index = e.currentTarget.dataset.index;
    const group = this.data.bindings.groups[index];
    
    if (!group) {
      wx.showToast({
        title: '未找到绑定信息',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 严格检查 configId 是否存在且有效
    const configId = group.configId;
    if (!configId || configId === 'undefined' || configId === 'null' || configId.trim() === '') {
      wx.showToast({
        title: '配置ID不存在，请重新绑定',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 检查必要的参数
    if (!group.targetId || !group.pkId) {
      wx.showToast({
        title: '绑定信息不完整',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/robot/config?type=group&targetId=${group.targetId}&pkId=${group.pkId}&configId=${configId}&pkName=${encodeURIComponent(group.pkName || '')}`
    });
  },

  /**
   * 解绑个人绑定
   */
  unbindPersonal: function () {
    wx.showModal({
      title: '确认解绑',
      content: '确定要解绑机器人吗？解绑后将不再接收机器人消息。',
      success: (res) => {
        if (res.confirm) {
          this.doUnbind('friend', this.data.bindings.personal.targetId);
        }
      }
    });
  },

  /**
   * 解绑群聊绑定
   */
  unbindGroup: function (e) {
    const index = e.currentTarget.dataset.index;
    const group = this.data.bindings.groups[index];
    
    wx.showModal({
      title: '确认解绑',
      content: `确定要解绑"${group.pkName}"的机器人吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doUnbind('group', group.targetId);
        }
      }
    });
  },

  /**
   * 执行解绑
   */
  doUnbind: function (type, targetId) {
    wx.showLoading({
      title: '解绑中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'robotManager',
      data: {
        action: 'unbind',
        type: type,
        targetId: targetId
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.errCode === 0) {
        wx.showToast({
          title: '解绑成功',
          icon: 'success',
          duration: 2000
        });
        this.loadBindings();
      } else {
        wx.showToast({
          title: res.result.errMsg || '解绑失败',
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('解绑失败:', err);
      wx.showToast({
        title: '解绑失败',
        icon: 'none',
        duration: 2000
      });
    });
  }
});
