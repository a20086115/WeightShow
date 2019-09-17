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
      console.log("获取授权信息....")
      CF.get("users", {
        openId: true
      }, (e) => {
        console.log(e)
        App.globalData.userInfo = e.result.data[0] || {};
        that.goIndex();
      })
      
    }, 300)
  },
  goIndex() {
    wx.redirectTo({ url: '/pages/index/index' })
  },
  goLogin() {
    wx.redirectTo({
      url:'/pages/login/index'
    })
  },
})
