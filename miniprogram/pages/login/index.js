import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
const App = getApp()

Page({
  data: {
    logged: false,
  },
  onLoad() { },
  onShow() {
  },
  getUserInfoFun(result) {
    App.initUserInfo(() => {
      this.back()
    })
  },
  back:function(){
    wx.navigateBack({
      complete: (res) => {
        var page = getCurrentPages().pop();
        if (page == undefined || page == null) return;
        page.onLoad();
      },
    })
  }
})