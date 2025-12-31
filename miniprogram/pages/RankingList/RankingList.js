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
    isInContinuousRank: false,
    countIndex: 0,
    reduceIndex: 0,
    continuousIndex: 0,
    loading: false,
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
    this.setData({ 
      loading: true,
      isInCountRank: false,
      isInReduceRank: false,
      isInContinuousRank: false,
      currentUsers: []
    })

    if(this.data.currentIndex == 0){
      // tab0 查询总共的打卡次数
      CF.ajax("getRankByRecordCount", {}, true
      ).then(res =>{
        this.setData({ loading: false })
        if(res.result && res.result.list){
          this.setData({ 
            currentUsers: res.result.list
           })
           const userInfo = getApp().globalData.userInfo
           if(userInfo && userInfo.openId){
             for(var usr of res.result.list){
              if(usr.openId == userInfo.openId){
                this.setData({ 
                  isInCountRank: true,
                  countIndex: res.result.list.indexOf(usr) + 1
                })
                return
              }
             }
           }
        }
      }).catch(err => {
        console.error('获取打卡榜失败:', err)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      })
    }else if(this.data.currentIndex == 1){
      // tab1 查询瘦身榜
      CF.ajax("getRankByReduceWeight", {
        beginDay: dayjs().startOf('month').format("YYYY-MM-DD"),
        endDay: dayjs().format("YYYY-MM-DD")
      }, true).then(res =>{
        this.setData({ loading: false })
        if(res.result && res.result.list){
          for(var user of res.result.list){
            if(user.recordsList && user.recordsList[0]){
              user.recordsList[0].reduce = (user.recordsList[0].reduce / 2).toFixed(2)
            }
          }
          this.setData({ 
            currentUsers: res.result.list
          })
          const userInfo = getApp().globalData.userInfo
          if(userInfo && userInfo.openId){
            for(var usr of res.result.list){
              if(usr.openId == userInfo.openId){
                this.setData({ 
                  isInReduceRank: true,
                  reduceIndex: res.result.list.indexOf(usr) + 1
                })
                return
              }
            }
          }
        }
      }).catch(err => {
        console.error('获取瘦身榜失败:', err)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      })
    }else if(this.data.currentIndex == 2){
      // tab2 查询连续打卡榜
      CF.ajax("getRankByContinuousDays", {}, true
      ).then(res =>{
        this.setData({ loading: false })
        if(res.result && res.result.list){
          this.setData({ 
            currentUsers: res.result.list
          })
          const userInfo = getApp().globalData.userInfo
          if(userInfo && userInfo.openId){
            for(var usr of res.result.list){
              if(usr.openId == userInfo.openId){
                this.setData({ 
                  isInContinuousRank: true,
                  continuousIndex: res.result.list.indexOf(usr) + 1
                })
                return
              }
            }
          }
        }
      }).catch(err => {
        console.error('获取连续打卡榜失败:', err)
        this.setData({ loading: false })
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      })
    }
  },
  onShareAppMessage() {
    return {
        title: '看看谁是最努力的减重达人！',
        path: '/pages/RankingList/RankingList',
        imageUrl: '/images/share-rank.png'
    }
  }
})