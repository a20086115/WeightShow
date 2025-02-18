import { cloud as CF } from '../../utils/cloudFunction.js'
const App = getApp()

import data from '../index/data.js'
Page({
  data: {
    indicatorDots: !1,
    autoplay: !1,
    current: 0,
    interval: 3000,
    duration: 1000,
    circular: !1,
  },
  onLoad() {

  },
  onShow() { 
    var that = this;
    setTimeout(function(){
      // 若用户授权过小程序
      CF.get("users", {
        openId: true
      }, (e) => {
        console.log("eeeee", e)
        App.globalData.userInfo = e.result.data[0] || {};
        // 如果为空，执行一次注册
        if(!App.globalData.userInfo.openId){
            CF.insert( "users",{
                nickName: '微信用户',
                avatarUrl: 'http://cdnjson.com/images/2025/02/19/132.jpg'
            },(res)=>{
                console.log('res', res)
                this.goIndex()
            })
        }else{
         that.goIndex();
        }
      }, () => {
        that.goIndex();
      })
    }, 1000)
  },
  goIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },
})
