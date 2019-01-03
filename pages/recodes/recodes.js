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
    obj: {
      "2018-10": [20, 30, null, 40],
      "2018-09": [20, 30, null, 40, 20, 30, null, 40, 20, 30, null, 40, 20, 30, null, 40, 20, 30, null, 40, 20, 30, null, 40]
    },
    curMonth: "2018-10",
    objCopy: {},
    scrollTop: 0,
    date: dateStr,
    visible: true,
    weight: null
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
  handleOk: function () {
    var arr = this.data.date.split("-");
    wx.cloud.callFunction({
      name: 'post',
      data: {
        data: {
          weight: this.data.weight,
          year_month: arr[0] + "-" + arr[1],
          date: this.data.date
        }
      },
    }).then(res => {
      console.log(res.result) // 3
    }).catch(console.error)

    this.setData({
      weight: null,
      visible: false
    })
  },
  handleClose: function () {
    this.setData({
      visible: false
    })
  },
  handleOkDelete: function () {
    var arr = this.data.date.split("-");
    console.log(arr[0], arr[1], arr[2], this.data.weight)
    this.addData(arr[0], arr[1], arr[2], 0);
    this.setData({
      visible2: false,
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
      date: event.currentTarget.dataset.day,
      weight: event.currentTarget.dataset.weight,
      visible: true
    })
  },
  deleteDay: function (event) {
    console.log("delete", event.currentTarget.dataset)
    this.setData({
      date: event.currentTarget.dataset.day,
      weight: event.currentTarget.dataset.weight,
      visible2: true
    })
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
    // var keyArr = Object.keys(this.obj)
    // keyArr.sort(function (a, b) {
    //   return a > b
    // })
    // for (let key of keyArr) {
    //   this.objCopy[key] = this.obj[key]
    // }
    this.getData()
  },
  //页面滚动执行方式
  onPageScroll(event) {
    this.setData({
      scrollTop: event.scrollTop
    })
  },
  addData: function (year, month, day, weight) {
    var datas = this.data.obj;
    var key = year + "-" + month;
    datas[key][parseInt(day)] = weight;
    console.log("datas:", datas)
    wx.cloud.callFunction({
      // 云函数名称
      name: 'add',
      // 传给云函数的参数
      data: {
        datas: datas
      },
    }).then(res => {
      console.log(res.result) // 3
    }).catch(console.error)
  },
  getData: function () {
    wx.cloud.callFunction({
      // 云函数名称
      name: 'get',
    }).then(res => {
      this.setData({
        obj: res.result.data.contents
      })
    }).catch(console.error)
  }
})