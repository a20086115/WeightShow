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
    type:"0",
    date:"",
    search: ""
  },
  
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      date: options.date,
    })
  },
  onChange(e) {
    this.setData({
      type: e.detail,
    });
  },
  onSearchChange(e) {
    this.setData({
      search: e.detail,
    });
  },
  onSearch() {
    wx.redirectTo({
      url: '/pages/foodList/foodList?key=' + this.data.search +"&type=" +  this.data.type + "&date=" + this.data.date,
    })
  },
  onClick() {
    
  },

})