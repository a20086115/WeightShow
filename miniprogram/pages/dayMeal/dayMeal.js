// miniprogram/pages/dayMeal/dayMeal.js
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
    }]
  },
  onChange(e) {
    this.setData({
      value: e.detail,
    });
  },
  onSearch() {
    Toast('搜索' + this.data.value);
  },
  onClick() {
    Toast('搜索' + this.data.value);
  },

})