// miniprogram/pages/food/foodList.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
import Toast from "../../miniprogram_npm/vant-weapp/toast/toast";
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentDate: "",
    currentFoods: [], // 食品列表
    currentFood:{}, // 当前选中食品
    currentType: 0, // 当前早餐午餐晚餐 0-1-2
    currentCount:1, // 当前选中的份数
    search: "", // 搜索关键词
    properties:["早餐","午餐","晚餐"],
    show: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      search: options.key,
      currentType: options.type,
      currentDate: options.date
    })
    console.log(options)
    this.queryFoodList();
  },
  onChange(e) {
    this.setData({
      search: e.detail,
    });
  },
  onSearch() {
    this.queryFoodList();
  },
  queryFoodList(){
    console.log(this.data)
    if(this.data.search){
      CF.list("foods",{
          _id:{
            $regex:'.*'+ this.data.search,
            $options: 'i'
          }
        },1,100).then(res =>{
          this.setData({
            currentFoods: res.result.data
          })
        })
    }
  },
  clickFoods(e){
    this.setData({ 
      show: true ,
      currentFood: e.currentTarget.dataset.item,
      currentCount: 1
    });
  },
  onClose() {
    this.setData({ show: false });
  },
  selectType(e){
    this.setData({ 
      currentType: e.currentTarget.dataset.index
    });
  },
  addCount(){
    this.setData({ 
      currentCount: ++this.data.currentCount
    });
  },
  modCount(){
    if(this.data.currentCount < 2){
      return;
    }
    this.setData({ 
      currentCount: --this.data.currentCount
    });
  },
  onCountChange(e){
    this.setData({ 
      currentCount: e.detail.value
    });
  },
  addDayMeal(){
      CF.insert("meal",{
        date: this.data.currentDate,
        count: parseFloat(this.data.currentCount),
        name: this.data.currentFood._id,
        type: this.data.currentType,
        calorie: parseFloat(this.data.currentFood.calorie)
      }).then( res => {
        this.setData({ show: false });
        Toast.success('添加成功');
      })
  }
})