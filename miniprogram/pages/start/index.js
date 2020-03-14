import { cloud as CF } from '../../utils/cloudFunction.js'
const App = getApp()

import data from '../index/data.js'
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
    var that = this;
    setTimeout(function(){
      // 若用户授权过小程序
      CF.get("users", {
        openId: true
      }, (e) => {
        App.globalData.userInfo = e.result.data[0] || {};
        that.goIndex();
      }, () => {
        that.goIndex();
      })
    }, 1000)
  },
  goIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },
})
