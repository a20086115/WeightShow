// miniprogram/pages/pk/pk.js
import pkHelp from "./help.js"
import * as echarts from '../../ec-canvas/echarts';
import dayjs from '../../utils/dayjs.min.js'
//获取应用实例
const App = getApp()
var xData = [];
var yData = [];
var bmiData = [];
var seriesData = [];
var seriesBmiData = [];
function setOption(chart, series) {
  var option = {
    title: {
      text: '本月体重曲线',
      left: 'center',
      z: 1,
      show: false
    },
    color: ["#37A2DA", '#B865DF'],
    legend: {
      data: ['体重'],
      show: true,
    },
    grid: {
      containLabel: true
    },
    tooltip: {
      show: true,
      // confine:true,
      trigger: 'axis',
      position: function (pos, params, dom, rect, size) {
        // 鼠标在左侧时 tooltip 显示到右侧，鼠标在右侧时 tooltip 显示到左侧。
        if (pos[0] < size.viewSize[0] / 2) {
          return { top: pos[1], left: pos[0] + 5 }
        } else {
          return { top: pos[1], right: size.viewSize[0] - pos[0] - 5 }
        }
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData
    },
    yAxis: [
      {
        x: 'center',
        type: 'value',
        name: '体重',
        nameLocation: 'end',
        min: function (value) {
          return parseInt(value.min - 4);
        }
      },
      {
        x: 'center',
        type: 'value',
        name: 'BMI指数',
        nameLocation: 'end',
        min: function (value) {
          return parseInt(value.min - 4);
        }
      }
    ],
    series: series
  };

  chart.setOption(option);
}


let chart = null
Page({

  /**
   * 页面的初始数据
   */
  data: {
    pk: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
      var data = JSON.parse(options.data)
      console.log(options, data)
      this.setData({
        pk: data
      })

      var month = dayjs().format("MM")
      var date = dayjs().date()
      for (var i = 1; i <= date; i++) {
        xData.push(month + "-" + (i < 10 ? "0" + i : i))
      }

      // 查询当月记录
      var member = data.members;
      var ajaxArray = [];
      for(let m of member){
        ajaxArray.push(this.queryRecordsByMonth(dayjs().format("YYYY-MM"), m.openId))
      }

      wx.showLoading({ title: '加载中...', icon: 'loading' })
      Promise.all(ajaxArray).then((res) => {
        console.log("queryRecordsByMonth success")
        wx.hideLoading();
        res.forEach((item, index) => {
          this.prepareSeriesData(item.result.data, member[index])
        })

        this.init()
      }).catch((e) => {
        console.log("queryRecordsByMonth failed", e)
        wx.hideLoading();
        wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
      })
      // this.queryRecordsByMonth(dayjs().format("YYYY-MM"))
  },
  prepareSeriesData(records, member){
    var obj = {
      name: member.nickname,
      type: 'line',
      smooth: true,
      data: []
    }
    var bmiObj = {
      name: member.nickname,
      type: 'line',
      smooth: true,
      data: []
    }
    var arr = new Array(xData.length);
    arr.fill(null);
    var bimData = new Array(xData.length);
    bimData.fill(null);
    for (var record of records) {
      if (record.weight) {
        arr[record.date.substr("8")] = record.weight
        if (member.height) {
          var weight = record.text;
          var height = member.height;
          if (member.kgFlag) {
            weight = weight / 2
          }
          var BMI = weight / (height * height / 10000);
          bimData[record.date.substr("8")] = BMI.toFixed(2)
        }
      }
    }
    obj.data = arr;
    bmiObj.data = bimData;
    seriesData.push(obj)
    seriesBmiData.push(bmiObj)
  },
  /**
  * 按日期查询
  */
  queryRecordsByMonth: function (month, openId) {
    console.log("queryRecordsByMonth" + month)
    var _this = this;
    return wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: month,
        openId: openId
      }
    })

    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: month
      }
    }).then((e) => {
      console.log("queryRecordsByMonth success")
      wx.hideLoading();
      this.showWeightRecords(e.result.data)
    
    }).catch(() => {
      console.log("queryRecordsByMonth failed")
      wx.hideLoading();
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
    })
  },
  /**
  * 展示体重数据到日历中
  */
  showWeightRecords: function (records) {
    var specialist = [];
    var mystatus = new Array(31);
    mystatus.fill(null);
    xData = [];
    yData = [];
    bmiData = [];
    for (var record of records) {
      record.text = record.weight;
      if (record.text) {
        xData.push(record.date);
        yData.push(record.text);
        if (App.globalData.userInfo.height) {
          var weight = record.text;
          var height = App.globalData.userInfo.height;
          if (App.globalData.userInfo.kgFlag) {
            weight = weight / 2
          }
          var BMI = weight / (height * height / 10000);
          bmiData.push(BMI.toFixed(2));
        }
      }
    }
    console.log(bmiData)
    this.init()
  },
  // 获取组件
  onReady: function () {
    this.ecComponent = this.selectComponent('#mychart-dom-line');
  },
  // 点击按钮后初始化图表
  init: function () {
    if (!this.ecComponent) {
      setTimeout(() => {
        console.log("获取canvas对象")
        this.init()
      }, 100)
      return
    }

    this.ecComponent.init((canvas, width, height) => {
      // 获取组件的 canvas、width、height 后的回调函数
      // 在这里初始化图表
      console.log(canvas, width, height)
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height
      });
      setOption(chart, seriesData);
      // 将图表实例绑定到 this 上，可以在其他成员函数（如 dispose）中访问
      this.chart = chart;
      this.setData({
        isLoaded: true,
        isDisposed: false
      });
      // 注意这里一定要返回 chart 实例，否则会影响事件处理等
      return chart;
    });
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    if (res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: '自定义转发标题',
      path: '/page/user?id=123',
      success: function (res) {
        // 转发成功
      },
      fail: function (res) {
        // 转发失败
      }
    }
  },
  
})