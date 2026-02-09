/*
 * @Author: YuWenqiang
 * @Date: 2025-01-20
 * @Description: 机器人配置页面（可复用）
 */

Page({
  /**
   * 页面的初始数据
   */
  data: {
    type: 'friend', // 'friend' 或 'group'
    targetId: '',
    pkId: '',
    pkName: '',
    configId: '',
    config: {
      speechStyle: 'encourage',
      config: {
        checkInTrigger: {
          enabled: true,
          delayMinutes: 0,
          personalCheckIn: { enabled: true },
          pkCheckIn: { enabled: true, atUser: true }
        },
        scheduledMessages: {
          morningPush: { enabled: true, timeRange: '07:30-08:30' },
          lunchReminder: { enabled: true, timeRange: '11:00-13:00' },
          eveningReminder: { enabled: true, timeRange: '19:00-20:00' },
          dailySummary: { enabled: true, timeRange: '21:00-22:00' },
          dailyReport: { enabled: true, timeRange: '21:00-22:00' }
        }
      }
    },
    speechStyles: [
      { label: '毒嘴型', value: 'sarcastic' },
      { label: '可爱型', value: 'cute' },
      { label: '鼓励型', value: 'encourage' },
      { label: '专业型', value: 'professional' }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const { type, targetId, pkId, pkName, configId } = options;
    
    // 处理 configId，排除 'undefined' 和 'null' 字符串
    let validConfigId = configId || '';
    if (validConfigId === 'undefined' || validConfigId === 'null') {
      validConfigId = '';
    }
    
    this.setData({
      type: type || 'friend',
      targetId: targetId || '',
      pkId: pkId || '',
      pkName: pkName ? decodeURIComponent(pkName) : '',
      configId: validConfigId
    });
    
    this.loadConfig();
  },

  /**
   * 加载配置信息
   */
  loadConfig: function () {
    // 检查必要参数：必须有 type 和 targetId
    if (!this.data.type || !this.data.targetId) {
      wx.showToast({
        title: '缺少必要参数',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 云函数 getConfig 只需要 type 和 targetId，不需要 configId
    wx.cloud.callFunction({
      name: 'robotManager',
      data: {
        action: 'getConfig',
        type: this.data.type,
        targetId: this.data.targetId
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.errCode === 0) {
        const configData = res.result.data;
        // 更新 configId（从返回的配置数据中获取）
        this.setData({
          config: configData,
          configId: configData._id || this.data.configId // 如果没有 configId，使用返回的 _id
        });
      } else {
        wx.showToast({
          title: res.result?.errMsg || '加载配置失败',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载配置失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    });
  },

  /**
   * 点击选择话术类型
   */
  selectSpeechStyle: function (e) {
    const speechStyle = e.currentTarget.dataset.value;
    if (speechStyle === this.data.config.speechStyle) {
      return; // 如果已经是选中状态，不处理
    }
    this.changeSpeechStyle({ detail: { value: speechStyle } });
  },

  /**
   * 切换话术类型
   */
  changeSpeechStyle: function (e) {
    const speechStyle = e.detail.value;
    
    // 检查 configId 是否存在
    if (!this.data.configId) {
      wx.showToast({
        title: '配置ID不存在，请重新加载',
        icon: 'none',
        duration: 2000
      });
      // 重新加载配置
      this.loadConfig();
      return;
    }
    
    wx.showLoading({
      title: '更新中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'robotManager',
      data: {
        action: 'updateSpeechStyle',
        configId: this.data.configId,
        speechStyle: speechStyle
      }
    }).then(res => {
      wx.hideLoading();
      if (res.result.errCode === 0) {
        this.setData({
          'config.speechStyle': speechStyle
        });
        wx.showToast({
          title: '更新成功',
          icon: 'success',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: res.result.errMsg || '更新失败',
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('更新话术类型失败:', err);
      wx.showToast({
        title: '更新失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 切换打卡评价开关
   */
  toggleCheckInTrigger: function (e) {
    const enabled = e.detail;
    this.updateConfig({
      'config.checkInTrigger.enabled': enabled
    });
  },

  /**
   * 切换个人打卡评价开关
   */
  togglePersonalCheckIn: function (e) {
    const enabled = e.detail;
    this.updateConfig({
      'config.checkInTrigger.personalCheckIn.enabled': enabled
    });
  },

  /**
   * 切换PK打卡评价开关
   */
  togglePkCheckIn: function (e) {
    const enabled = e.detail;
    this.updateConfig({
      'config.checkInTrigger.pkCheckIn.enabled': enabled
    });
  },

  /**
   * 切换@用户开关
   */
  toggleAtUser: function (e) {
    const enabled = e.detail;
    this.updateConfig({
      'config.checkInTrigger.pkCheckIn.atUser': enabled
    });
  },

  /**
   * 切换定时推送开关
   */
  toggleScheduledMessage: function (e) {
    const { type } = e.currentTarget.dataset;
    const enabled = e.detail;
    
    let path = '';
    if (type === 'morning') {
      path = 'config.scheduledMessages.morningPush.enabled';
    } else if (type === 'lunch') {
      path = 'config.scheduledMessages.lunchReminder.enabled';
    } else if (type === 'evening') {
      path = 'config.scheduledMessages.eveningReminder.enabled';
    } else if (type === 'dailySummary') {
      path = 'config.scheduledMessages.dailySummary.enabled';
    } else if (type === 'dailyReport') {
      path = 'config.scheduledMessages.dailyReport.enabled';
    }
    
    if (path) {
      this.updateConfig({
        [path]: enabled
      });
    }
  },

  /**
   * 更新配置
   */
  updateConfig: function (updates) {
    // 检查 configId 是否存在
    if (!this.data.configId) {
      wx.showToast({
        title: '配置ID不存在，请重新加载',
        icon: 'none',
        duration: 2000
      });
      // 重新加载配置
      this.loadConfig();
      return;
    }
    
    wx.showLoading({
      title: '保存中...',
      mask: true
    });
    
    // 构建更新对象
    const updateData = {};
    Object.keys(updates).forEach(key => {
      const keys = key.split('.');
      let obj = updateData;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = updates[key];
    });
    
    // 合并到现有配置
    const config = JSON.parse(JSON.stringify(this.data.config));
    const mergeConfig = (target, source) => {
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          mergeConfig(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };
    mergeConfig(config.config, updateData.config);
    
    wx.cloud.callFunction({
      name: 'robotManager',
      data: {
        action: 'updateConfig',
        configId: this.data.configId,
        config: config
      }
    }).then(res => {
      wx.hideLoading();
      console.log('更新配置响应:', res);
      
      if (res.result && res.result.errCode === 0) {
        // 更新本地数据
        try {
          // 构建 setData 对象
          const setDataObj = {};
          Object.keys(updates).forEach(key => {
            setDataObj[key] = updates[key];
          });
          setDataObj['config'] = config;
          
          this.setData(setDataObj);
          
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 2000
          });
        } catch (error) {
          console.error('更新本地数据失败:', error);
          // 即使本地更新失败，服务器已经更新成功，仍然提示成功
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 2000
          });
        }
      } else {
        const errMsg = (res.result && res.result.errMsg) || '保存失败';
        console.error('更新配置失败:', res.result);
        wx.showToast({
          title: errMsg,
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('更新配置异常:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 解绑
   */
  unbind: function () {
    wx.showModal({
      title: '确认解绑',
      content: '确定要解绑机器人吗？解绑后将不再接收机器人消息。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '解绑中...',
            mask: true
          });
          
          wx.cloud.callFunction({
            name: 'robotManager',
            data: {
              action: 'unbind',
              type: this.data.type,
              targetId: this.data.targetId
            }
          }).then(res => {
            wx.hideLoading();
            if (res.result.errCode === 0) {
              wx.showToast({
                title: '解绑成功',
                icon: 'success',
                duration: 2000
              });
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
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
      }
    });
  }
});
