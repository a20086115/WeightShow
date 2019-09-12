import { cloud as CF } from '../../utils/cloudFunction.js'
import dayjs from '../../utils/dayjs.min.js'
import * as echarts from '../../ec-canvas/echarts';
//获取应用实例
const App = getApp()
const TODAY = dayjs().format("YYYY-MM-DD");

var xData = [];
var yData = [];
function setOption(chart) {
  var option = {
    title: {
      text: '',
      left: 'center',
      z:1,
    },
    color: ["#37A2DA"],
    legend: {
      data: ['A'],
      top: 50,
      left: 'center',
      backgroundColor: 'red',
      z: 100,
      show: false
    },
    grid: {
      containLabel: true
    },
    tooltip: {
      show: true,
      // confine:true,
      trigger: 'axis',
      formatter: '{b0}: {c0}'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data:xData
      // data: ["2019-09-04", "2019-09-05", "2019-09-06", "2019-09-07", "2019-09-08"],
      // show: false
    },
    yAxis: {
      x: 'center',
      type: 'value',
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
      // show: false
    },
    series: [{
      name: '体重',
      type: 'line',
      smooth: true,

      data: yData
      // data: ["81", "81", "81", "81", "81"]
    }]
  };

  chart.setOption(option);
  
  
}

let chart = null
Page({
  data: {
    visibleBmi:false,
    ec: {
      // 将 lazyLoad 设为 true 后，需要手动初始化图表
      lazyLoad: true
    },
    currentdate: dayjs().format("YYYY-MM-DD"),
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
    height:"",
    heightInput:0,
    showChange: false,
    visible: false, // 控制模态框的显示
    visibleHeight: false, // 体重输入框
    bmiInfo: "点击授权查看BMI指数",
    weight: 0,  // 输入框的value
    lastWeight: "", // 最新体重
    text: false, // 记录点击日期的体重
    records:[],
    kgFlag: true
  },
  onReady: function () {
    // 获取组件
    this.ecComponent = this.selectComponent('#mychart-dom-line');
  },
  onChange(event) {
    // 需要手动对 checked 状态进行更新
    this.setData({ kgFlag: event.detail });
  },
  // 点击按钮后初始化图表
  init: function () {
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
    this.setData({
      height: App.globalData.userInfo.height || "",
      kgFlag: App.globalData.userInfo.kgFlag || false
    })
    // 查询最新体重
    this.queryLastRecord();
    // 查询当月记录
    this.queryRecordsByMonth(dayjs().format("YYYY-MM"))
  },
  showBmiInfo: function(){
    wx.showModal({
      content: 'BMI指数（英文为Body Mass Index，简称BMI），是用体重公斤数除以身高米数平方得出的数字，是目前国际上常用的衡量人体胖瘦程度以及是否健康的一个标准。当我们需要比较及分析一个人的体重对于不同高度的人所带来的健康影响时，BMI值是一个中立而可靠的指标。',
      showCancel:false
    })
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
    const week = e.detail.week;
    this.setData({
      currentdate: date,
      visible: true,
      text: text,
      weight: text || ""
    })
  },
  /**
   * 点击提交体重
   */
  handleInsertWeight: function (e) {
    if (e.detail != "confirm") {
      return;
    }
    var date = this.data.currentdate;
    var weight = this.data.weight;
    if(weight == this.data.text){
      // 较之前没有改变
      return;
    }
    if (this.data.text) {   // 之前已经有值
      console.log("update")
      // 输入数据
      if(weight){
        CF.update("records", {
          openId: true,
          date: date,
        }, {
            weight: weight
          }, () => {
            this.queryLastRecord()
            this.updateRecords(date, weight)
        })
      }else{ // 未输入数据 ， 将这条记录删除
        CF.delete("records", {
          openId: true,
          date: date,
        }, () => {
            this.queryLastRecord()
            this.deleteRecords(date, weight)
        })
      }

    }else{
      console.log("insert")
      CF.insert("records", {
        date: date,
        weight: weight
      }, () => {
        this.queryLastRecord()
        this.insertRecords(date, weight)
      })
    }
  },

  /**
 * 点击提交身高
 */
  handleInsertHeight: function (e) {
    if (e.detail != "confirm") {
      this.setData({
        height: App.globalData.userInfo.height,
        kgFlag: App.globalData.userInfo.kgFlag
      })
      return;
    }
    // 输入数据
    var height = this.data.height
    var kgFlag = this.data.kgFlag
    if (height) {
      CF.update("users", {
        openId: true
      }, {
          height: height,
          kgFlag: kgFlag
      }, () => {
        App.globalData.userInfo.height = height;
        App.globalData.userInfo.kgFlag = kgFlag;
        this.getBMI(height, this.data.lastWeight)
      })
    }
  },
  /**
   * 按日期查询
   */
  queryRecordsByMonth: function(month){
    console.log("queryRecordsByMonth" + month)
    var _this = this;
    wx.showLoading({title: '加载中...',icon: 'loading'})
    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: month
      }
    }).then((e) => {
      console.log("queryRecordsByMonth success")
      wx.hideLoading();
      // 处理今天的默认颜色
      this.data.records = e.result.data;
      this.showWeightRecords(e.result.data)
    }).catch(() => {
      console.log("queryRecordsByMonth failed")
      wx.hideLoading();
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
    })
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
        var height = this.data.height;
        _this.getBMI(height, lastWeight)
        _this.setData({
          lastWeight: lastWeight
        })
      }else{
        this.setData({
          bmiInfo: "点击设置身高，可查看BMI"
        })
      }
    }).catch(() => {
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
    })
  },
  getBMI: function (height, weight) {
    console.log("getBMI", weight, height)
    if(!this.data.kgFlag){
      weight = weight/2
    }

    if (!App.globalData.userInfo.avatarUrl) {
      this.setData({
        bmiInfo: "点击授权，查看BMI指数"
      })
      return;
    }
    if(!height){
      this.setData({
        bmiInfo: "点击设置身高，查看BMI指数"
      })
      return;
    }
    if (!weight) {
      this.setData({
        bmiInfo: "点击日历设置体重，查看BMI指数"
      })
      return;
    }
    var BMI = weight / (height * height / 10000);
    this.setData({
      BMI: BMI.toFixed(2),
      bmiInfo: "您的BMI指数为" + BMI.toFixed(2)
    })

  },
  /**
   * 设置体重数据到日历中
   */
  showWeightRecords: function(records){
    var specialist = [];
    xData = [];
    yData = [];
    for(var record of records){
      record.text = record.weight;
      xData.push(record.date);
      yData.push(record.text);
    }
    if(records.length > 0 && records[records.length - 1].date == TODAY){
      records[records.length - 1].background = "#188be4";
    }else{
      records.push({
        date: TODAY,
        background: "#188be4"
      })
    }
    this.setData({
      speciallist: records
    })
    console.log(records)
    console.log(xData)
    console.log(yData)
    this.init()
  },

  showWeightWithCanvas: function(){
    // xData
  },
  /**
   * 修改体重数据
   */
  updateRecords: function(date, weight){
    console.log("1",date, weight)
    var records = this.data.records;
    for (var record of records) {
      if(record.date == date){
        record.text = weight;
        this.setData({
          records: records,
          speciallist: records
        })
        return;
      }
    }

    console.log(this.data)
  },
  /**
 * 删除体重数据
 */
  deleteRecords: function (date, weight) {
    var records = this.data.records;
    if (date == TODAY) {
      records[records.length - 1].text = "";
    } else {
      for (var record of records) {
        if (record.date == date) {
          var index = records.indexOf(record);
          records.splice(index, 1)
        }
      }
    }

    this.setData({
      records: records,
      speciallist: records
    })
  },
  /**
   * 新增体重数据
   */
  insertRecords: function (date, weight) {
    console.log("insertRecords",date, weight)
    var records = this.data.records;
    if(date == TODAY){
      records[records.length - 1].text = weight;
    }else{
      records.push({
        date: date,
        text: weight
      });
    }
    this.setData({
      records: records,
      speciallist: records
    })

    console.log(this.data)
  },
  /**
   * 体重输入框
   */
  onChangeWeight: function(e){
    this.setData({
      weight: e.detail
    })
  },
  /**
   * 身高输入框
   */
  onChangeHeight: function (e) {
    this.setData({
      height: e.detail
    })
  },
  changeHeight: function(e){
    console.log(e)
    if (App.globalData.userInfo.avatarUrl){
      this.setData({
        visibleHeight: true
      })
    }else{
      wx.redirectTo({
        url: '/pages/login/index'
      })
    }
  },
  showBmiTip: function () {
    this.setData({
      visibleBmi: true
    })
  }
})

