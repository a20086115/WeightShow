/*
 * @Author: YuWenqiang
 * @Date: 2021-06-16 18:36:43
 * @Description: 
 * 
 */
//app.js
wx.cloud.init({
  //env: "ceshi-206e10"
  env: "release-ba24f3" 
})
import { cloud as CF } from './utils/cloudFunction.js'
import Toast from "./miniprogram_npm/@vant/weapp/toast/toast";
App({
  onLaunch: function () {},
  Toast:Toast,
  globalData: {
    userInfo: {},
    data: {},
  },
  initUserInfo(cb){
    if(this.globalData.userInfo.openId){
      cb && cb();
      return;
    }
    CF.get("users", {
      openId: true
    }, (e) => {
      this.globalData.userInfo = e.result.data[0] || {};
      cb && cb();
    }, () => {
      cb && cb();
    })
  },
  /**
   * 确保已从 cloud users 拿到文档（含 _id）。无 _id 时会请求云库，供 PK 列表等依赖主键的逻辑使用。
   * @returns {Promise<object>} 当前的 globalData.userInfo
   */
  ensureUserInfoWithId() {
    if (this.globalData.userInfo && this.globalData.userInfo._id) {
      return Promise.resolve(this.globalData.userInfo);
    }
    const app = this;
    return new Promise((resolve) => {
      CF.get(
        'users',
        { openId: true },
        (e) => {
          app.globalData.userInfo = (e.result && e.result.data && e.result.data[0]) || {};
          resolve(app.globalData.userInfo);
        },
        () => {
          resolve(app.globalData.userInfo || {});
        }
      );
    });
  },
  getBmi(weight, height){
    var tips = [{
      color:"RGB(141,216,248)",
      left: "分类",
      right: "BMI 范围"
    }, {
        color: "#0066CC",
        left: "偏瘦",
        right: " <= 18.4"
      }, {
        color: "#01814A",
        left: "正常",
        right: "18.5 ~ 23.9"
      }, {
        color: "#C6A300",
        left: "过重",
        right: "24.0 ~27.9"
      }, {
        color: "#AE0000",
        left: "肥胖",
        right: ">= 28.0 "
      }];
    if(weight && height){
      var BMI = weight / (height * height / 10000);
      var bmiColor, bmiInfo;
      if (BMI <= 18.4){
        bmiColor = tips[1].color
        bmiInfo = tips[1].left
      }else if(BMI < 24){
        bmiColor = tips[2].color
        bmiInfo = tips[2].left
      }else if(BMI < 28){
        bmiColor = tips[3].color
        bmiInfo = tips[3].left
      }else{
        bmiColor = tips[4].color
        bmiInfo = tips[4].left
      }
      return {
        bmi : BMI.toFixed(2),
        bmiColor: bmiColor,
        bmiInfo: bmiInfo
      };
    }else{
      return {
        bmi: "无法计算"
      }
    }
  }
})
