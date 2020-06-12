// miniprogram/pages/food/foodList.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentFoods: [],
    value: ""
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log(options)
    this.setData({
      value: options.key
    })

    this.queryFoodList();
  },
  onChange(e) {
    this.setData({
      value: e.detail,
    });
  },
  onSearch() {
    this.queryFoodList();
  },
  queryFoodList(){
    if(this.data.value){
      CF.list("foods",{
          _id:{
            $regex:'.*'+ this.data.value,
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
    console.log(e)
  }

})