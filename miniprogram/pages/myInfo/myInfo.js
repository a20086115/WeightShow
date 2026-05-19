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
   * 每次进入「组队PK」Tab 都会拉列表；用户信息若晚于首屏就绪，从其它页返回时也会再拉一次。
   */
  onShow: function () {
    this.queryPk()
  },

  /**
   * 拉取当前用户所在 PK 列表；若尚未拿到 users._id，会先经 App.ensureUserInfoWithId 拉取用户文档。
   */
  async queryPk(){
    await App.ensureUserInfoWithId();
    const userInfo = App.globalData.userInfo;
    if (!userInfo || !userInfo._id || !userInfo.openId) {
      return;
    }
    CF.get("pk", { "members.openId": userInfo.openId }, (e) => {
      this.setData({
        pkList: e.result.data
      })
    })
  },
  // 展示name输入框
  newPk(){
    this.setData({
      visible_name: true
    })
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
        CF.update("pk", { _id: this.data.pk._id }, this.data.pk, () => {
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
  // 输入框（支持原生 input 的 e.detail.value 与 van-field 的 e.detail）
  onValueChange(e) {
    var key = e.target.id;
    var obj = {};
    obj[key] = e.detail.value !== undefined ? e.detail.value : e.detail;
    this.setData(obj);
  }
})