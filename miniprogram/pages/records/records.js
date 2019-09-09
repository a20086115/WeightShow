import { cloud as CF } from '../../utils/cloudFunction.js'
import  dayjs  from '../../utils/dayjs.min.js'

const date = new Date()
const year = date.getFullYear();
var month = date.getMonth() + 1;
var day = date.getDate();
month = month < 10 ? "0" + month : month;
day = day < 10 ? "0" + day : day;
var dateStr = year + "-" + month + "-" + day
Page({

  /**
   * 页面的初始数据
   */
  data: {
    obj: [],
    curMonth: dayjs().format("yyyy-mm"),
    objCopy: {},
    scrollTop: 0,
    date: dayjs().format("yyyy-mm-dd"),
    visible: false,
    weight: null,
    isUpdate: false,
    currentDay: {}
  },
  bindDateChange: function (e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
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
    console.log(e)
    if(e.detail != "confirm"){
      return;
    }

    var arr = this.data.date.split("-");
    wx.cloud.callFunction({
      name: this.data.isUpdate ? "put" : "post",
      data: {
        data: {
          weight: this.data.weight,
          year_month: arr[0] + "-" + arr[1],
          date: this.data.date
        }
      },
    }).then(res => {
      console.log(res)
      if(res.result.done){
        wx.showToast({
          title: '新增失败，该日期数据已经存在！',
          icon: 'none',
          duration: 2000
        })
      }else{
        this.getData()
      }
    }).catch(console.error)
    this.setData({
      weight: null,
      visible: false,
      isUpdate: false
    })
  },
  handleClose: function () {
    alert("close")
    this.setData({
      visible: false
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
      date: dateStr,
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
    wx.cloud.callFunction({
      name: 'get',
    }).then(res => {
      console.log(res)
      this.setData({
        obj: res.result
      })
    }).catch(console.error)
  }
})