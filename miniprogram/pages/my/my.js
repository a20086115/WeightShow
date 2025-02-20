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
    message:"有问题可随时咨询，也欢迎对小程序提出意见和建议~感谢🙇",
    visibleNoticeDialog:false,
    noticeImage:"",
    noticeContent:""
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取用户信息
    if(getApp().globalData && getApp().globalData.userInfo.avatarUrl){
      this.setData({
        avatarUrl: getApp().globalData.userInfo.avatarUrl,
        userInfo: getApp().globalData.userInfo
      })
      // 获取用户信息更新
      // this.updateUserPhoto();
    }

  },
  onShow(){
    // 获取用户信息
    if(getApp().globalData && getApp().globalData.userInfo.avatarUrl){
      this.setData({
        avatarUrl: getApp().globalData.userInfo.avatarUrl,
        userInfo: getApp().globalData.userInfo
      })
    }
  },

  /**
   *  跳转到完善信息页面
   */
  navToUserInfoPage:function () {
    // 跳转到UserInfo 设置界面
    wx.navigateTo({
      url: '/pages/userinfo/userinfo',
    })
  },
  /**
   *  跳转到关于我们页面
   */
  navToLinkusPage:function(){
    wx.navigateTo({
      url: '/pages/aboutUs/about',
    })
  },
  /**
   *  跳转到赞助页面
   */
  navToSponsorPage:function(){
    wx.navigateTo({
      url: '/pages/my/sponsor',
    })
  },
  /**
   * 
   * @param {*} e 
   */
  navToEle:function(){
    wx.navigateToMiniProgram({
      appId: 'wxece3a9a4c82f58c9',
      path: 'ele-recommend-price/pages/guest-fire/index?inviterId=595443fa&actId=1',
      success(res) {
        // 打开成功
      }
    })
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
  },
  queryLastActivity(){
    CF.get("notice", {}).then(res => {
      if(res.result && res.result.data){
        var notice = res.result.data[0];
        this.setData({
          visibleNoticeDialog:true,
          noticeContent: notice.content,
          noticeImage: notice.image
        })
      }
    })
  },
  showNoticeDialog(){
    this.setData({
      visibleNoticeDialog:true
    })
  },
  closeNoticeDialog(){
    this.setData({
      visibleNoticeDialog:false
    })
  },
})