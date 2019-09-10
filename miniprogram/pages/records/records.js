import { cloud as CF } from '../../utils/cloudFunction.js'
import  dayjs  from '../../utils/dayjs.min.js'

Page({

  /**
   * 页面的初始数据
   */
  data: {
    obj: [],
    curMonth: dayjs().format("YYYY-MM"),
    objCopy: {},
    scrollTop: 0,
    date: dayjs().format("YYYY-MM-DD"),
    visible: false,
    weight: null,
    isUpdate: false,
    currentDay: {}
  },
  bindDateChange: function (e) {
    this.setData({
      date: e.detail.value
    })
  },
  bindKeyInput: function (e) {
    this.setData({
      weight: e.detail.value
    })
  },
  handleInsertOk: function (e) {
    if(e.detail != "confirm"){
      return;
    }
    CF.get("records", {
      date: this.data.date,
    }, (res) =>{
      if(res.result.data.length == 0){
        CF.insert("records", {
          date: this.data.date,
          weight: this.data.weight
        }, () => {
          console.log("成功")
        }, (err) => {
          console.log(err)
        })
      }else{
        wx.showToast({
          title: '新增失败，该日期数据已经存在！',
          icon: 'none',
          duration: 2000
        })
      }
    }, () =>{
      
    })
  },
  handleOkDelete: function () {
    wx.cloud.callFunction({
      // 云函数名称
      name: 'delete',
      // 传给云函数的参数
      data: {
        id: this.data.currentDay._id
      },
    }).then(res => {
      this.getData()
    }).catch(console.error)

    this.setData({
      visible2: false
    })
  },
  handleCloseDelete: function () {
    this.setData({
      visible2: false
    })
  },
  clickMonth: function (event) {
    if (this.data.curMonth == event.currentTarget.dataset.month) {
      month = ""
    } else {
      month = event.currentTarget.dataset.month
    }
    this.setData({
      curMonth: month,
    })
  },
  clickDay: function (event) {
    console.log(event.currentTarget.dataset)
    this.setData({
      date: event.currentTarget.dataset.day.date,
      weight: event.currentTarget.dataset.day.weight,
      visible: true,
      isUpdate: true
    })
  },
  deleteDay: function (event) {
    this.setData({
      currentDay: event.currentTarget.dataset.day,
      visible2: true
    })
    // wx.cloud.callFunction({
    //   name: "delete",
    //   data: {
    //     id: event.currentTarget.dataset.day._id
    //   },
    // }).then(res => {
    //   this.getData()
    // }).catch(console.error)
  },
  addDay: function (event) {
    this.setData({
      visible: true
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.getData()
  },
  //页面滚动执行方式
  onPageScroll(event) {
    this.setData({
      scrollTop: event.scrollTop
    })
  },
  getData: function () {
    CF.get("records", {
      openId: true
    }, res => {
      this.setData({
        obj: res.result
      })
    })
  }
})