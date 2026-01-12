// miniprogram/pages/peopleInfo/peopleInfo.js
import { cloud as CF } from '../../utils/newCloudFunction.js'
import Toast from "../../miniprogram_npm/@vant/weapp/toast/toast";

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentUser: {
      avatarUrl: "",
      nickName: "",
      height: "",
      aimWeight: "",
      aimWeightKg: "",
      aimBmi: ""
    }
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail 
    if (!avatarUrl) {
      wx.showToast({
        icon: 'none',
        title: '未选择头像',
      })
      return
    }
    
    // 先更新本地显示
    this.setData({
      'currentUser.avatarUrl': avatarUrl,
    })
    
    // 检查 openId 是否存在
    const app = getApp()
    const openId = app.globalData.userInfo?.openId
    if (!openId) {
      wx.showToast({
        icon: 'none',
        title: '请先登录',
      })
      return
    }
    
    // 获取文件扩展名
    const fileExtension = avatarUrl.split('.').pop() || 'jpg'
    const cloudPath = `avatar/${openId}.${fileExtension}`
    
    console.log('[上传文件] 开始上传：', cloudPath)
    wx.showLoading({
      title: '上传中',
      mask: true
    })
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: res => {
        wx.hideLoading()
        console.log('[上传文件] 成功：', cloudPath, res)
        if (res.fileID) {
          // 保存到记录中去
          this.setData({
            'currentUser.avatarUrl': res.fileID,
          })
          wx.showToast({
            icon: 'success',
            title: '上传成功',
            duration: 1500
          })
        } else {
          wx.showToast({
            icon: 'none',
            title: '上传失败：未返回文件ID',
          })
        }
      },
      fail: err => {
        wx.hideLoading()
        console.error('[上传文件] 失败：', err)
        let errorMsg = '上传失败'
        if (err.errMsg) {
          if (err.errMsg.includes('permission')) {
            errorMsg = '上传失败：权限不足'
          } else if (err.errMsg.includes('network')) {
            errorMsg = '上传失败：网络错误'
          } else {
            errorMsg = `上传失败：${err.errMsg}`
          }
        }
        wx.showToast({
          icon: 'none',
          title: errorMsg,
          duration: 2000
        })
      }
    })
  },
  onLoad: function (options) {
    // 先设置默认用户信息，让页面先渲染，提升用户体验
    var userInfo = {... getApp().globalData.userInfo}
    // 如果有目标体重和身高，计算目标BMI
    if (userInfo.aimWeightKg && userInfo.height) {
      userInfo.aimBmi = this.calculateAimBmi(userInfo.aimWeightKg, userInfo.height)
    }
    this.setData({ currentUser: userInfo })
  },
  
  /**
   * 生命周期函数--监听页面初次渲染完成
   * 页面渲染完成后再调用接口，避免阻塞页面切换
   */
  onReady: function () {
    // 页面渲染完成后再获取最新体重信息
    this.loadLatestWeight()
  },
  
  /**
   * 加载最新体重信息
   */
  loadLatestWeight: function () {
    var userInfo = {...this.data.currentUser}
    // 获取 最新体重 信息
    CF.list("records", {openId: true}, 1, 1, "date", "desc", (res) =>{
      if(res.result.data && res.result.data.length > 0){
        var itemData = res.result.data[0];
        userInfo.weight = itemData.weight;
        userInfo.weightKg = itemData.weightKg;
        // 获取 BMI 信息
        let bmiObj = getApp().getBmi(userInfo.weightKg, userInfo.height)
        userInfo.bmi = bmiObj.bmi;
        this.setData({ currentUser: userInfo })
      }
    })
  },
  // 新增或编辑信息
  saveData() {
    // 参数完整性校验
    var currentUser = this.data.currentUser;
    if (currentUser.age && currentUser.nickName && currentUser.height && currentUser.aimWeight) {
      // 更新的查询条件
      CF.update("users", {openId: true}, {
        avatarUrl: this.data.currentUser.avatarUrl,
        nickName: this.data.currentUser.nickName,
        age: parseInt(this.data.currentUser.age),
        height: parseFloat(this.data.currentUser.height),
        aimWeight: parseFloat(this.data.currentUser.aimWeight),
        aimWeightKg: parseFloat(this.data.currentUser.aimWeightKg)
      }, (data) => {
        Toast.success('更新成功');
        getApp().globalData.userInfo = this.data.currentUser
        wx.navigateBack({
          complete: (res) => {
            var page = getCurrentPages().pop();
            if (page == undefined || page == null) return;
            page.onLoad();
          },
        })
      })
    } else {
      Toast.fail('请将信息填写完整');
    }

  },
  /**
   * 计算目标BMI
   * @param {number} aimWeightKg 目标体重（千克）
   * @param {number} height 身高（厘米）
   * @returns {number} 目标BMI
   */
  calculateAimBmi(aimWeightKg, height) {
    if (!aimWeightKg || !height) {
      return ""
    }
    const bmi = aimWeightKg / (height * height / 10000)
    return parseFloat(bmi.toFixed(2))
  },
  // 输入框
  onValueChange(e) {
    var value = e.detail;
    var id = e.target.id;
    var key = "currentUser." + id;
    var obj = {};
    obj[key] = value;

    // 如果是输入的kg体重， 自动计算斤的体重；反之同理
    if(id == "aimWeightKg"){
      obj["currentUser.aimWeight"] = parseFloat(value) * 2;
      // 计算目标BMI
      if (this.data.currentUser.height) {
        obj["currentUser.aimBmi"] = this.calculateAimBmi(parseFloat(value), this.data.currentUser.height)
      }
    }else if(id == "aimWeight"){
      obj["currentUser.aimWeightKg"] = parseFloat(value) / 2;
      // 计算目标BMI
      if (this.data.currentUser.height) {
        obj["currentUser.aimBmi"] = this.calculateAimBmi(parseFloat(value) / 2, this.data.currentUser.height)
      }
    }else if(id == "height"){
      // 计算当前BMI
      obj["currentUser.bmi"] = getApp().getBmi(this.data.currentUser.weightKg, parseFloat(value)).bmi;
      // 计算目标BMI
      if (this.data.currentUser.aimWeightKg) {
        obj["currentUser.aimBmi"] = this.calculateAimBmi(this.data.currentUser.aimWeightKg, parseFloat(value))
      }
    }
    this.setData(obj)
  }
})