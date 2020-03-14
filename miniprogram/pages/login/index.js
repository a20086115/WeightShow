import { cloud as CF } from '../../utils/cloudFunction.js'
const App = getApp()

Page({
  data: {
    logged: false,
  },
  onLoad() { },
  onShow() {
  },
  getUserInfoFun(result) {
    var that = this;
    if (result.detail.encryptedData) {
      CF.insert("users", result.detail.userInfo,(e)=>{
        CF.get("users", {
          openId: true
        }, (e) => {
          App.globalData.userInfo = e.result.data[0] || {}; 
          this.back()
        })
      })
    } else {
      wx.showModal({
        title: '提示',
        content: '您取消了授权，可能会造成使用受限',
        showCancel: false,
      })
      return false
    }
  },
  back:function(){
    wx.navigateBack({delta: 1})
  }
})