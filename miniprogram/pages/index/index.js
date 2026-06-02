Page({
  onLoad() {
    this.goHome();
  },

  onShow() {
    this.goHome();
  },

  goHome() {
    wx.switchTab({
      url: '/pages/indexV2/index'
    });
  }
});
