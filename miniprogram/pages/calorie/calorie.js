import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
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
      text: '本月卡路里曲线',
      left: 'center',
      z:1,
      show: true
    },
    color: ["#37A2DA"],
    grid: {
      containLabel: true
    },
    tooltip: {
      show: true,
      // confine:true,
      trigger: 'axis',
      position: function (pos, params, dom, rect, size) {
        // 鼠标在左侧时 tooltip 显示到右侧，鼠标在右侧时 tooltip 显示到左侧。
        if (pos[0] < size.viewSize[0] / 2){
          return { top: pos[1], left: pos[0] + 5 }
        }else{
          return { top: pos[1], right: size.viewSize[0] - pos[0] - 5 }
        }
      },
      formatter : function(params){
        return params[0].name + ": " + params[0].data  + " 千卡" 
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data:xData
    },
    yAxis: [
      {
        x: 'center',
        type: 'value',
        name: '卡路里',
        nameLocation: 'end',
        min: function (value) {
          return parseInt(value.min - 200) < 0 ? 0 : parseInt(value.min - 200);
        }
      }
    ],
    series: [{
      name: '卡路里',
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: yData
    }]
  };
  chart.setOption(option);
}
let chart = null
Page({
  data: {
    currentdate: dayjs().format("YYYY-MM-DD"),
    currentMonth: dayjs().format("YYYY-MM"),
    speciallist:[],
    mystatus:[],
    txt_style: "txt_style",
    ec: {
      // 将 lazyLoad 设为 true 后，需要手动初始化图表
      lazyLoad: true
    },
  },
  // TODO: 获取当日 合适进食卡路里， 绘制曲线
  // 获取组件
  onReady: function () {
    this.ecComponent = this.selectComponent('#mychart-calorie');
    console.log(this.ecComponent)
  },
  // 点击按钮后初始化图表
  init: function () {
    if (!this.ecComponent){
      this.ecComponent = this.selectComponent('#mychart-calorie');
      console.log(this.ecComponent)
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
    wx.navigateTo({
      url: "/pages/dayMeal/dayMeal?date=" + date,
    })
  },
  /**
   * 按日期查询
   */
  queryRecordsByMonth: function(month){
    CF.ajax( "getMealRecordByMonth", {
        month: month
      }).then(res => {
      console.log(res)
      var list = res.result.list;
      this.showRecordsByMonth(list)
    })
  },
  /**
  * 展示饮食数据到日历中
  */
  showRecordsByMonth: function (records) {
    var specialist = [];
    var mystatus = new Array(31).fill(null);
    this.data.days = {}
    xData = [];
    yData = [];
    var USER_CALORIE = 500;
    for (var record of records) {
      this.data.days[record._id] = record;
      record.date = record._id

      if(record.totalCalorie <= USER_CALORIE){  // 吃少了
        mystatus[record.date.substring(8) - 1] = 1;
      }else{ // 超了
        mystatus[record.date.substring(8) - 1] = 0;
      }
      console.log(mystatus)
      if (record.date) {
        xData.push(record.date);
        yData.push(record.totalCalorie);
      }
    }
    
    // 默认当天变色
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
  }
})

