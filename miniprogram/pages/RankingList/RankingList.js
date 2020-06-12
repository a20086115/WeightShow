import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentIndex: 0,
    currentUsers:[]
  },
  
  /*点击分类标签切换排行榜*/
  onClick(event){
    console.log(event)
    this.setData({
      currentIndex: event.detail.index
    })
    this.getRankData();
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.getRankData();
  },

  getRankData: function(){
    CF.ajax({
      name : "getRankByType", 
      data: {
        type: this.data.currentIndex
      }
    }).then(res =>{
      console.log(res)
      this.setData({
        currentUsers: res.result.data
      })
    })
  }
 
})