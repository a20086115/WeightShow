import { cloud as CF } from '../../utils/cloudFunctionPromisejs'
import dayjs from '../../utils/dayjs.min.js'
import * as echarts from '../../ec-canvas/echarts';

//获取应用实例
const App = getApp()
const TODAY = dayjs().format("YYYY-MM-DD");
Page({
  data: {
    currentdate: dayjs().format("YYYY-MM-DD"),
    currentMonth: dayjs().format("YYYY-MM"),
    speciallist:[],
    txt_style: "txt_style",
    mystatus:[],
    ec: null
  },
  // 获取组件
  onReady: function () {
    this.ecComponent = this.selectComponent('#mychart-dom-line');
  },
  // 点击按钮后初始化图表
  init: function () {
    if (!this.ecComponent){
      setTimeout(() =>{
        console.log("获取canvas对象")
        this.init()
      },100)
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
      setOption(chart);

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
  onLoad: function(){
    // 查询当月记录
    this.queryRecordsByMonth(dayjs().format("YYYY-MM"))
  },
  /**
  * 点击上个月
  */
  prevMonth: function (e) {
    var currentYear = e.detail.currentYear;
    var currentMonth = e.detail.currentMonth;
    if(currentMonth < 10){
      currentMonth = "0" + currentMonth;
    }
    this.setData({
      currentMonth: currentYear + "-" + currentMonth
    })
    this.queryRecordsByMonth(currentYear + "-" + currentMonth)
  },
  /**
  * 点击下个月
  */
  nextMonth: function (e) {
    var currentYear = e.detail.currentYear;
    var currentMonth = e.detail.currentMonth;
    if (currentMonth < 10) {
      currentMonth = "0" + currentMonth;
    } 
    this.setData({
      currentMonth: currentYear + "-" + currentMonth
    })
    this.queryRecordsByMonth(currentYear + "-" + currentMonth)
  },
  /**
   * 点击日期
   */
  selectDate: function(e) {
    console.log(e)
    const date = e.detail.date;
    if(dayjs().isBefore(dayjs(date))){
      wx.showToast({ title: '不可以选择未来的日期噢...', icon: 'none' })
      return;
    }
    const text = e.detail.text;
    this.setData({ })
  },
  /**
   * 按日期查询
   */
  queryRecordsByMonth: function(month){
    CF.list("meal", {openId: true}, 1, 100, "createdate", desc)
  },
  /**
  * 展示饮食数据到日历中
  */
  showRecordsByMonth: function (records) {
    var specialist = [];
    var mystatus = new Array(31);
    this.data.days = {}
    mystatus.fill(null);
    xData = [];
    yData = [];
    bmiData = [];
    for (var record of records) {
      this.data.days[record.date] = record;
      record.text = record.weight;
      if (record.fileid) {
        mystatus[record.date.substring(8) - 1] = 1;
      }
      if (record.text) {
        xData.push(record.date);
        yData.push(record.text);
        if(App.globalData.userInfo.height){
          var weight = record.text;
          var height = this.data.height;
          if (!this.data.kgFlag) {
            weight = weight / 2
          }
          var BMI = weight / (height * height / 10000);
          bmiData.push(BMI.toFixed(2));
        }
      }
    }
    
    if (this.data.days[TODAY]) {
      records[records.length - 1].background = "#188be4";
    } else if (this.data.currentMonth == dayjs().format("YYYY-MM")) {
      records.push({
        date: TODAY,
        background: "#188be4"
      })
    }
    this.data.records = records
    this.setData({
      mystatus: mystatus,
      speciallist: records,
      hiddenChart: xData.length == 0
    })

    console.log(mystatus)
    console.log(records)
    console.log(xData)
    console.log(yData)
    this.init()
  },
  /**
   * 查询最新体重
   */
  queryLastRecord: function () {
    var _this = this;
    wx.cloud.callFunction({
      name: 'getLastWeightRecord',
    }).then((e) => {
      console.log("queryLastRecord")
      console.log(e)
      if (e.result.data && e.result.data.length > 0){
        var lastWeight = e.result.data[0].weight;
        this.setData({
          lastWeight: lastWeight,
        })
      }
      this.getBMI()
    }).catch(() => {
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
    })
  },
})

