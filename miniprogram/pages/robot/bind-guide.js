/*
 * 群绑定机器人说明页：展示微信号与绑定步骤，供 PK 详情页「绑定机器人」跳转
 */
const ROBOT_WECHAT_ID = 'wxbot222';

Page({
  data: {
    robotWechatId: ROBOT_WECHAT_ID,
    pkId: '',
    pkName: '',
    bindMessage: ''
  },

  onLoad(options) {
    const pkId = options.pkId || options.id || '';
    const pkName = options.pkName ? decodeURIComponent(options.pkName) : '';
    const bindMessage = pkId ? `绑定：${pkId}` : '';
    this.setData({
      pkId,
      pkName,
      bindMessage
    });
    if (pkName) {
      wx.setNavigationBarTitle({
        title: `绑定机器人 - ${pkName}`
      });
    }
  },

  copyBindMessage() {
    const { bindMessage } = this.data;
    if (!bindMessage) {
      wx.showToast({ title: '暂无绑定消息', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: bindMessage,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  copyWechatId() {
    wx.setClipboardData({
      data: this.data.robotWechatId,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  }
});
