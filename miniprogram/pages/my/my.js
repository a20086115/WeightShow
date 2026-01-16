import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
import dayjs from '../../utils/dayjs.min.js';

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
    htmlImage:"cloud://release-ba24f3.7265-release-ba24f3-1257780911/activity.png", // 默认值，会被 params 覆盖
    customerServiceImage:"cloud://release-ba24f3.7265-release-ba24f3-1257780911/notice/notice2.png", // 默认值，会被 params 覆盖
    message:"有问题可随时咨询，也欢迎对小程序提出意见和建议~感谢🙇",
    visibleNoticeDialog:false,
    noticeImage:"",
    noticeContent:"",
    showYearlyReportEntry: false, // 是否显示年度报告入口
    lastCheckTime: 0 // 上次检查年度报告的时间戳，用于避免频繁调用
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
    // 加载配置参数（二维码图片路径）
    this.loadParamsConfig();
    // 检查是否显示年度报告入口
    this.checkYearlyReportEntry();
  },
  onShow(){
    // 获取用户信息
    if(getApp().globalData && getApp().globalData.userInfo.avatarUrl){
      this.setData({
        avatarUrl: getApp().globalData.userInfo.avatarUrl,
        userInfo: getApp().globalData.userInfo
      })
    }
    // 避免频繁调用接口：如果距离上次检查超过5秒才重新检查
    const now = Date.now();
    if (now - this.data.lastCheckTime > 5000) {
      this.checkYearlyReportEntry();
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
      visibleJoinGroup: true
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
  
  /**
   * 检查是否显示年度报告入口（仅在2026年1月30日之前显示，且2025年至少有2条打卡记录）
   */
  checkYearlyReportEntry: function() {
    // 更新检查时间戳
    this.setData({
      lastCheckTime: Date.now()
    });
    
    const deadline = dayjs('2026-01-30');
    const now = dayjs();
    const isBeforeDeadline = now.isBefore(deadline);
    
    // 如果不在时间范围内，直接不显示
    if (!isBeforeDeadline) {
      this.setData({
        showYearlyReportEntry: false
      });
      return;
    }
    
    // 检查2025年是否有至少2条打卡记录
    wx.cloud.callFunction({
      name: 'getYearlyReport',
      data: {
        year: '2025'
      }
    }).then((res) => {
      if (res.result.errCode) {
        // 查询失败，不显示入口
        this.setData({
          showYearlyReportEntry: false
        });
        return;
      }
      
      const records = res.result.records || [];
      // 至少需要2条打卡记录才显示入口
      const hasEnoughRecords = records.length >= 2;
      
      this.setData({
        showYearlyReportEntry: hasEnoughRecords
      });
    }).catch((err) => {
      console.error('检查年度报告入口失败:', err);
      // 查询失败，不显示入口
      this.setData({
        showYearlyReportEntry: false
      });
    });
  },
  
  /**
   * 跳转到年度报告页面
   */
  goToYearlyReport: function() {
    wx.navigateTo({
      url: '/pages/yearlyReport/yearlyReport?year=2025'
    });
  },
  
  /**
   * 从云数据库 params 表加载配置参数
   */
  loadParamsConfig: function() {
    // 获取加群二维码图片路径
    CF.get("params", {
      code: "join_group_qrcode_image"
    }).then(res => {
      if (res.result && res.result.data && res.result.data.length > 0) {
        const config = res.result.data[0];
        if (config.value) {
          this.setData({
            htmlImage: config.value
          });
        }
      }
    }).catch(err => {
      console.error('获取加群二维码配置失败:', err);
    });
    
    // 获取在线客服二维码图片路径
    CF.get("params", {
      code: "customer_service_qrcode_image"
    }).then(res => {
      if (res.result && res.result.data && res.result.data.length > 0) {
        const config = res.result.data[0];
        if (config.value) {
          this.setData({
            customerServiceImage: config.value
          });
        }
      }
    }).catch(err => {
      console.error('获取在线客服二维码配置失败:', err);
    });
  },
})