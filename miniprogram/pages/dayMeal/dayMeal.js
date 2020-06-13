// miniprogram/pages/dayMeal/dayMeal.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
import Dialog  from '../../miniprogram_npm/vant-weapp/dialog/dialog';
import Toast from "../../miniprogram_npm/vant-weapp/toast/toast";
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
    type:"0",
    date:"",
    search: "",
    currentFoods:[], // 按类型选择获得
    totalFoods:[], // 当日总数据
  },
  
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      date: options.date,
    })
    this.queryDataList();
  },
  // 根据日期，查询当前的就餐记录
  queryDataList(){
    CF.ajax("getMealRecordByDay", {
      date: this.data.date
    }).then(res =>{
      this.data.totalFoods = res.result.list;
      // 计算早中晚三餐 总数
      var total1 = 0, total2 = 0,total = 0;
      this.data.totalFoods.forEach(item => {
        if(item.type == 0){
          total+= item.calorie * item.count
        }else if(item.type == 1){
          total1+= item.calorie * item.count
        }else if(item.type == 2){
          total2+= item.calorie * item.count
        }
      })
      this.setData({
        sidebars: [{
          name: "早餐",
          totalCalorie:total.toFixed(2)
        },{
          name: "午餐",
          totalCalorie:total1.toFixed(2)
        },{
          name: "晚餐",
          totalCalorie:total2.toFixed(2)
        }],
      })

      this.calCurrentFoods();
    })
  },
  // 根据总用餐和当前type选择， 计算要展示的
  calCurrentFoods(){
    var arr = this.data.totalFoods.filter(item => {
      return item.type == this.data.type
    })
    this.setData({
      currentFoods: arr
    })
  },
  onClickNav(e) {
    console.log(e)
    this.setData({ type: e.currentTarget.dataset.index });
    this.calCurrentFoods()
  },
  onSearchChange(e) {
    this.setData({ search: e.detail });
  },
  onSearch() {
    wx.redirectTo({
      url: '/pages/foodList/foodList?key=' + this.data.search +"&type=" +  this.data.type + "&date=" + this.data.date,
    })
  },
  clickFoods(e){
    var meal = e.currentTarget.dataset.item;
    Dialog.confirm({
      title: '友情提示',
      message: '是否确定删除' + meal.name + "的就餐记录？",
    }) .then(() => {
      // on confirm
      CF.delete("meal", {_id: meal._id}).then(res => {
        Toast.success('删除成功');
        this.queryDataList()
      })
    })
    .catch(() => {
      // on cancel
    });
  },

})