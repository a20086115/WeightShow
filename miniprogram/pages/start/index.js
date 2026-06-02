const App = getApp()

Page({
  data: {
    indicatorDots: !1,
    autoplay: !1,
    current: 0,
    interval: 3000,
    duration: 1000,
    circular: !1,
  },
  onLoad() {

  },
  onShow() { 
    App.initUserInfo(() => {
      this.goIndex();
    })
  },
  goIndex() {
    wx.switchTab({ url: '/pages/indexV2/index' })
  },
})
