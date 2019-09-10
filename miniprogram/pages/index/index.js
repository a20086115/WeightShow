import { cloud as CF } from '../../utils/cloudFunction.js'
//获取应用实例
const app = getApp()

const date = new Date()
const year = date.getFullYear();
var month = date.getMonth() + 1;
var day = date.getDate();
month = month<10 ? "0" + month : month;
day = day<10 ? "0" + day : day;
var dateStr = year + "-" + month + "-" + day
Page({
  data: {
    curYear: new Date().getFullYear(), // 年份
    curMonth: new Date().getMonth() + 1,// 月份 1-12
    day: new Date().getDate(), // 日期 1-31 若日期超过该月天数，月份自动增加
    speciallist:[],
    txt_style: "txt_style",
    tips: [{
      color:"RGB(141,216,248)",
      left: "分类",
      right: "BMI 范围"
    }, {
        color: "RGB(204,204,204)",
        left: "偏瘦",
        right: " <= 18.4"
      }, {
        color: "RGB(102,204,0)",
        left: "正常",
        right: "18.5 ~ 23.9"
      }, {
        color: "RGB(255,255,0)",
        left: "过重",
        right: "24.0 ~27.9"
      }, {
        color: "RGB(255,153,0)",
        left: "肥胖",
        right: ">= 28.0 "
      },],
    date: dateStr,
    height:0,
    heightInput:0,
    showChange: false
  },
  bindDateChange: function (e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
    this.setData({
      date: e.detail.value
    })
  },
  onLoad: function(){
    this.setData({
      height: wx.getStorageSync("height")
    })
    this.setData({
      speciallist: [
        { date: '2019-09-02', background: 'yellow', text: '文字1', color: '' },
        { date: '2019-09-05', background: 'red', text: '文字2' },
      ]
    })
  },
  onShow: function () {
    this.getData();
  },
  getData: function(){
    CF.get("records", {
      openId: true
    }, res => {
      if (!res.result) {
        return;
      }
      var arr = [];
      for (let item of res.result) {
        arr = arr.concat(item.data);
      }
      this.setData({
        arr: arr
      })
      this.lineShow();
      this.getBMI(arr[0].weight);
    })
  },
  showBmiInfo: function(){
    wx.showModal({
      content: 'BMI指数（英文为Body Mass Index，简称BMI），是用体重公斤数除以身高米数平方得出的数字，是目前国际上常用的衡量人体胖瘦程度以及是否健康的一个标准。当我们需要比较及分析一个人的体重对于不同高度的人所带来的健康影响时，BMI值是一个中立而可靠的指标。',
      showCancel:false
    })
  },
  bindconfirm(e) {
    var height = this.data.heightInput
    this.setData({
      height: height,
      showChange: false
    })
    wx.setStorage({
      key: 'height',
      data: height
    })
    this.getBMI();
  },
  getBMI:function(){
    var weight = this.data.arr[0].weight
    var BMI = weight / (this.data.height * this.data.height/10000);
    this.setData({
      BMI: BMI.toFixed(2)
    })
  },
  changeHeight: function(){
    this.setData({
      showChange: true
    })
  },
  getHeight: function(e){
    var val = e.detail.value;
    this.setData({
      heightInput: val
    });
  },
  /**
  * 点击上个月
  */
  nextMonth: function (e) {
    console.log(e)
    const currentYear = e.detail.currentYear;
    const currentMonth = e.detail.currentMonth;
    wx.showModal({
      title: '当前日期',
      content: '当前年份：' + currentYear + '年\n当前月份：' + currentMonth + '月'
    });
  },
})
