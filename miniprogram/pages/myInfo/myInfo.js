/*
 * @Author: YuWenqiang
 * @Date: 2021-06-16 18:36:43
 * @Description: 
 * 
 */
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
    // 先让页面渲染，避免阻塞页面切换
  },
  
  /**
   * 生命周期函数--监听页面初次渲染完成
   * 页面渲染完成后再调用接口，避免阻塞页面切换
   */
  onReady: function () {
    this.queryPk()
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
      if (this.data.pk._id)  {   // 之前已经有值
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
    var index = e.currentTarget.dataset.index;
    var data = JSON.stringify(this.data.pkList[index]);
    App.globalData.currentPk = this.data.pkList[index]
    wx.navigateTo({
      url: '/pages/pk/pk?data=' + data,
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