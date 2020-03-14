// miniprogram/pages/pk/pk.js
import pkHelp from "./help.js"
Page({

  /**
   * 页面的初始数据
   */
  data: {
    pk: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
      var data = JSON.parse(options.data)
      console.log(options, data)
      this.setData({
        pk: data
      })
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },
  
})