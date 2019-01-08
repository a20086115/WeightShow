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
    dataInfo: [
      {
        id: 1,
        subNum: "C1609050001",
        percentage: 30,
        grade: "SPCC",
        spec: "2.5*1200*C",
        weight: 500
      },
      {
        id: 2,
        subNum: "A1609050001",
        percentage: 80,
        grade: "SPCC",
        spec: "3.5*1200*C",
        weight: 100
      }
    ],
    date: dateStr,
  },
  bindDateChange: function (e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
    this.setData({
      date: e.detail.value
    })
  },
  onLoad: function () {
    this.getData();
     
  },
  click () {
    console.log("!")
    wx.cloud.callFunction({
      // 云函数名称
      name: 'add',
      // 传给云函数的参数
      data: {
        contents: {
          "2018-10":{
            "01": "70",
            "02": "60"
          }
        }
      },
    }).then(res => {
        console.log(res.result) // 3
    }).catch(console.error)
    this.ringShow()
  },
  getData: function(){
    wx.cloud.callFunction({
      name: 'get',
    }).then(res => {
      console.log(res)
      this.lineShow();
    }).catch(console.error)
  },
  lineShow: function(){
    var random1 = Math.floor(Math.random() * (500 - 50 + 1) + 50),
      random2 = Math.floor(Math.random() * (800 - 100 + 1) + 100),
      random3 = Math.floor(Math.random() * (1000 - 200 + 1) + 200),
      random4 = Math.floor(Math.random() * (300 - 10 + 1) + 10),
      random5 = Math.floor(Math.random() * (600 - 300 + 1) + 300)

      let line = {
        canvasId: 'lineGraph', // canvas-id
        type: 'line', // 图表类型，可选值为pie, line, column, area, ring
        categories: ['201708', '201709', '201710', '201711', '201712'],
        series: [{ // 数据列表
          name: ' ',
          data: [random1, random2, random3, random4, random5]
        }],
        yAxis: {
          min: 300 // Y轴起始值
        },
        width: 310,
        height: 200,
        dataLabel: true, // 是否在图表中显示数据内容值
        legend: false, // 是否显示图表下方各类别的标识
        extra: {
          lineStyle: 'curve' // (仅对line, area图表有效) 可选值：curve曲线，straight直线 (默认)
        }
      }
    new wxCharts(line);
  },
  add: function(){
    
  }
})
