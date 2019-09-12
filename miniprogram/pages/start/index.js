import { cloud as CF } from '../../utils/cloudFunction.js'
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
  onLoad() { },
  onShow() { 
    var that = this;
    setTimeout(function(){
      // getUserInfo: 若用户授权过小程序，进入success回调，返回用户信息；
      // 用户未授权，进入fail，跳转到授权界面。
      console.log("获取授权信息....")
        wx.getUserInfo({
          success: function (result) {
            CF.get("users", {
              openId: true
            }, (e) => {
              console.log(e)
              App.globalData.userInfo = e.result.data[0];
              that.goIndex();
            })
          },
          fail: function (result) {
            console.log("获取授权信息失败，跳转到授权页....")
            that.goIndex();
            // that.goLogin();
          }
        })
      
    }, 200)
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
