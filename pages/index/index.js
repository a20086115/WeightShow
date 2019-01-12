//index.js
//获取应用实例
const app = getApp()
var wxCharts = require('../../utils/wxcharts.js');

const date = new Date()
const year = date.getFullYear();
var month = date.getMonth() + 1;
var day = date.getDate();
month = month<10 ? "0" + month : month;
day = day<10 ? "0" + day : day;
var dateStr = year + "-" + month + "-" + day
Page({
  data: {
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
  },
  onShow: function () {
    this.getData();
  },
  getData: function(){
    wx.cloud.callFunction({
      name: 'get',
    }).then(res => {
      console.log(res)
      var arr = [];
      for(let item of res.result){
        arr = arr.concat(item.data);
      }
      this.setData({
        arr: arr
      })
      this.lineShow();
      this.getBMI(arr[0].weight);
    }).catch(console.error)
  },
  lineShow: function(){
      var weightArr = [];
      var dateArr = [];
      for(let item of this.data.arr){
        weightArr.push(item.weight)
        dateArr.push(item.date.substring(5))
      }

      let line = {
        canvasId: 'lineGraph', // canvas-id
        type: 'line', // 图表类型，可选值为pie, line, column, area, ring
        categories: dateArr.reverse(),
        series: [{ // 数据列表
          name: ' ',
          data: weightArr.reverse()
        }],
        yAxis: {
          min: 300 // Y轴起始值
        },
        width: 350,
        height: 200,
        dataLabel: true, // 是否在图表中显示数据内容值
        legend: false, // 是否显示图表下方各类别的标识
        extra: {
          lineStyle: 'curve' // (仅对line, area图表有效) 可选值：curve曲线，straight直线 (默认)
        }
      }
    new wxCharts(line);
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
  }
})
