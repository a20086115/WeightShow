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
      aimWeightKg: ""
    }
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail 
    this.setData({
      'currentUser.avatarUrl': avatarUrl,
    })
    console.log("xxxx", e)
    const cloudPath = 'avatar/' +  getApp().globalData.userInfo.openId
    wx.showLoading({
      title: '上传中',
    })
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: res => {
        wx.hideLoading()
        console.log('[上传文件] 成功：', cloudPath, res)
        // 保存到记录中去
        this.setData({
          'currentUser.avatarUrl':  res.fileID,
        })
      },
      fail: e => {
        wx.hideLoading()
        wx.showToast({
          icon: 'none',
          title: '上传失败',
        })
      }
    })
  },
  onLoad: function (options) {
    // 获取 USERINFO　信息, 拷贝一下
    var userInfo = {... getApp().globalData.userInfo}
   
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
      }else{
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
    }else if(id == "aimWeight"){
      obj["currentUser.aimWeightKg"] = parseFloat(value) / 2;
    }else if(id == "height"){
      // 计算BMI
      obj["currentUser.bmi"] = getApp().getBmi(this.data.currentUser.weightKg, parseFloat(value)).bmi;
    }
    this.setData(obj)
  }
})