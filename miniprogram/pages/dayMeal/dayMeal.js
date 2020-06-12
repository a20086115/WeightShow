// miniprogram/pages/dayMeal/dayMeal.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    sidebars: [{
      name: "早餐",
      totalCalorie:200
    },{
      name: "午餐",
      totalCalorie:200
    },{
      name: "晚餐",
      totalCalorie:200
    }],
    currentFoods:[{
      name: "早餐",
      totalCalorie:200
    },{
      name: "午餐",
      totalCalorie:200
    },{
      name: "晚餐",
      totalCalorie:200
    }],
    value:""
  },
  onChange(e) {
    this.setData({
      value: e.detail,
    });
  },
  onSearch() {
    wx.redirectTo({
      url: '/pages/foodList/foodList?key=' + this.data.value,
    })
  },
  onClick() {
    
  },

})