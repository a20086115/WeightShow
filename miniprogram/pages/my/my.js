import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
Page({
  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl: '../../images/user-unlogin.png',
    userInfo: {},
    app:getApp(),
    visibleFeedback: false,
    visibleJoinGroup: false,
    htmlImage:"cloud://release-ba24f3.7265-release-ba24f3-1257780911/activity.png",
    message:"有问题可随时咨询，也欢迎对小程序提出意见和建议~感谢🙇"
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              this.setData({
                avatarUrl: res.userInfo.avatarUrl,
                userInfo: res.userInfo
              })
            }
          })
        }
      }
    })
  },

  /**
   *  跳转到完善信息页面
   */
  navToUserInfoPage:function () {
    if(!getApp().globalData.userInfo.openId){
      // 如果用户没有授权 或 没有查询到用户信息。 提示先授权。
      // 请先授权
      wx.showToast({
        icon: 'none',
        title: '请先授权',
      })
      wx.navigateTo({
        url: '/pages/login/index'
      })
      return;
    }else{
      // 跳转到UserInfo 设置界面
      wx.navigateTo({
        url: '/pages/userinfo/userinfo',
      })
    }
  },
  /**
   *  跳转到关于我们页面
   */
  navToLinkusPage:function(){
    wx.navigateTo({
      url: '/pages/aboutUs/about',
    })
  },
  onGetUserInfo: function (e) {
    if (!this.data.logged && e.detail.userInfo) {
      this.setData({
        logged: true,
        avatarUrl: e.detail.userInfo.avatarUrl,
        userInfo: e.detail.userInfo
      })
      getApp().globalData.userInfo = e.detail.userInfo;
      // 执行注册
      CF.ajax("updateOrInsert",{ 
        tbName: "users",
        query:{
          openId: true,
        },
        data: e.detail.userInfo 
      }).then(e=>{
        CF.get("users", {
          openId: true
        }).then(e => {
          getApp().globalData.userInfo = e.result.data[0] || {}; 
        })
      })
    }
  },
  openFeedback(){
    this.setData({
      message:"有问题可随时咨询，也欢迎对小程序提出意见和建议~感谢🙇",
      visibleFeedback: true
    })
  },
  onFeedbackClose(){
    this.setData({
      visibleFeedback: false
    })
  },
  openJoinGroupDialog(){
    this.setData({
      message:"发送【加群】给客服，客服会回复群聊二维码~欢迎加群一起交流哦🙇",
      visibleFeedback: true
    })
  },
  closeJoinGroup(e){
    this.setData({
      visibleJoinGroup: false
    })
    if (e.detail != "confirm") {
      return;
    }
    wx.cloud.downloadFile({
      fileID: this.data.htmlImage, // 文件 ID
      success: res => {
        // 返回临时文件路径
        wx.showToast({
          title: '保存二维码成功',
          icon: 'success',
          duration: 2000
        })
      },
      fail: console.error
    })
  }
})