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
      // 把授权获得的数据 存到全局属性
      App.globalData.userInfo = result.detail.userInfo;
      // 从网络获取
      CF.insert("users", App.globalData.userInfo,()=>{
        wx.switchTab({ url: '/pages/index/index' })
      })
    } else {
      wx.showModal({
        title: '提示',
        content: '您取消了授权，可能会造成使用受限',
        showCancel: false,
      })
      return false
    }
  }
})