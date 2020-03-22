// miniprogram/pages/myInfo/myInfo.js
import { cloud as CF } from '../../utils/cloudFunction.js'
const App = getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl:"",
    userInfo:{},
    showTipFlag: false,
    pk:{},
    pkList:[],
    visible_name: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.initUserInfo();

  },

  initUserInfo() {
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          console.log("已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框")
          wx.getUserInfo({
            success: res => {
              this.setData({
                avatarUrl: res.userInfo.avatarUrl,
                userInfo: res.userInfo
              })
            }
          })
          this.queryPk();
        }else{
          // 未授权
          console.log("未授权")
        }
      }
    })
  },
  queryPk(){
    if(App.globalData.userInfo._id){
      CF.get("pk", { "members.openId": App.globalData.userInfo.openId }, (e) => {
        this.setData({
          pkList: e.result.data
        })
      })
    }
  },
  // 展示name输入框
  newPk(){

    // wx.showModal({
    //   title: '提示',
    //   content: '正在紧急开发中,马上上线啦!',
    // })
    if (App.globalData.userInfo._id) {
      this.setData({
        visible_name: true
      })
    }else{
      wx.showModal({
        title: '提示',
        content: '请先授权登陆',
        success(res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' })
          } 
        }
      })
    }
  },
   /**
   * 点击提交PK
   */
  handleInsertPk (e) {
    this.setData({
      visible_name: false
    })
    if (e.detail == "confirm") {
      if (this.data.pk._id) {   // 之前已经有值
        CF.update("pk", { _id: pk._id }, this.data.pk, () => {
          this.queryPk()
        })
      } else {
        this.data.pk.members = [App.globalData.userInfo];
        CF.insert("pk", this.data.pk, () => {
          this.queryPk()
        })
      }
    }
  },
  clickPk(e){
    var curPk = e.currentTarget.dataset.item;
    var data = JSON.stringify(curPk);
    wx.navigateTo({
      url: '/pages/pk/pk?data=' + data,
    })
  },
  deletePk(e){
    var curPk = e.currentTarget.dataset.item
    wx.showModal({
      title: '提示',
      content: '确定要删除' + curPk.name + "吗?",
      success(res) {
        CF.delete("pk", { _id: curPk._id}, ()=>{
          this.queryPk();
        })
      }
    })
  },
  changePk(item){
    console.log(item)
  },
  // 关闭弹框
  onClose (){
    this.setData({
      showTipFlag: false
    })
  },
  // 输入框
  onValueChange(e) {
    var key = e.target.id;
    var obj = {};
    obj[key] = e.detail;
    this.setData(obj)
  }
})