import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
import dayjs from '../../utils/dayjs.min.js'
Page({
  /**
   * 页面的初始数据
   */
  data: {
    currentIndex: 0,
    currentUsers:[],
    isInCountRank:false,
    isInReduceRank:false,
    countIndex: 0,
    reduceIndex: 0,
  },
  
  /*点击分类标签切换排行榜*/
  onClick(event){
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
    if(this.data.currentIndex == 0){
      // tab0 查询总共的打卡次数
      CF.ajax("getRankByRecordCount", { }
      ).then(res =>{
        this.setData({ 
          currentUsers: res.result.list
         })
         for(var usr of res.result.list){
          if(usr.openId == getApp().globalData.userInfo.openId){
            this.setData({ 
              isInCountRank: true,
              countIndex: res.result.list.indexOf(usr) + 1
            })
            return
          }
         }
        })
    }else if(this.data.currentIndex == 1){
      // tab1 查询排行榜
      CF.ajax("getRankByReduceWeight", {
        beginDay: dayjs().startOf('month').format("YYYY-MM-DD"),
        endDay: dayjs().format("YYYY-MM-DD")
      }).then(res =>{
        for(var user of res.result.list){
          user.recordsList[0].reduce = (user.recordsList[0].reduce / 2).toFixed(2)
        }
        this.setData({ 
          currentUsers: res.result.list
        })
        for(var usr of res.result.list){
          if(usr.openId == getApp().globalData.userInfo.openId){
            this.setData({ 
              isInReduceRank: true,
              reduceIndex: res.result.list.indexOf(usr) + 1
            })
            return
          }
        }
      })
    }
  }
 
})