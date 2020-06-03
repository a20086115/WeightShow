// miniprogram/pages/pk/pk.js
import { cloud as CF } from '../../utils/cloudFunction.js'
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
    legend: {
      type: 'scroll',
      bottom: 10,
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
        name: '体重/BMI',
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
    pk: {},
    visibleInviteDialog: false,
    ec: {
      // 将 lazyLoad 设为 true 后，需要手动初始化图表
      lazyLoad: true
    },
    titleFlag: true,
    },
    showBmi:false
  },
  changeTitle(){
    this.setData({
      showBmi: !this.data.showBmi
    })
    console.log(seriesBmiData)
    if(this.data.showBmi){
      setOption(this.chart, seriesBmiData);
    } else {
      setOption(this.chart, seriesData);
    }
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
      this.initXdata();
      if (options.id) {
        var id = decodeURIComponent(options.id);
        CF.get("pk", { _id: id }, (e) => {
          this.setData({
            pk: e.result.data[0]
          })
          this.requestData();
        });
        // 查询授权信息
        CF.get("users", {
          openId: true
        }, (e) => {
          App.globalData.userInfo = e.result.data[0] || {};
          this.setData({
            visibleInviteDialog: true
          })
        })
      }else{
        var data = JSON.parse(options.data)
        this.setData({
          pk: data
        })
        this.requestData();
      }
  },
  clickTitle(){
    this.setData({
      titleFlag: !this.data.titleFlag
    })
    setOption(this.chart, this.data.titleFlag ? seriesData : seriesBmiData)
  },
  goBack(){
    wx.switchTab({
      url: '/pages/index/index',
    })
  },
  initXdata(){
    xData = []
    var month = dayjs().format("MM")
    var date = dayjs().date()
    for (var i = 1; i <= date; i++) {
      xData.push(month + "-" + (i < 10 ? "0" + i : i))
    }
  },
  requestData(){
    // 查询当月记录
    // 清空信息
    seriesData.length = 0;
    seriesBmiData.length = 0;
    var member = this.data.pk.members;
    var ajaxArray = [];
    for (let m of member) {
      ajaxArray.push(this.queryRecordsByMonth(dayjs().format("YYYY-MM"), m.openId))
    }

    wx.showLoading({ title: '加载中...', icon: 'loading' })
    Promise.all(ajaxArray).then((res) => {
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
  },
  // 邀请
  onInviteClose(e){
    var openId = App.globalData.userInfo.openId;
    if (!openId) {
      // 请先授权
      wx.showToast({ icon: 'none', title: '请先授权'})
      wx.navigateTo({ url: '/pages/login/index' })
      return;
    }
    this.setData({
      visibleInviteDialog: false
    });
    // 判断是否在组队中
    for(let member of this.data.pk.members){
      if(member.openId == App.globalData.userInfo.openId){
        return;
      }
    }
    this.data.pk.members.push(App.globalData.userInfo)
    if(e.detail == "confirm"){
      CF.update("pk",{_id: this.data.pk._id},{
        members: this.data.pk.members
      },()=>{
        wx.showToast({
          title: '组队成功',
        })
        this.setData({
          pk: this.data.pk
        })
        this.requestData()
      })
    }
  },
  prepareSeriesData(records, member){
    var obj = {
      name: member.nickName,
      type: 'line',
      smooth: true,
      data: [],
      yAxisIndex: 0,
      connectNulls: true
    }
    var bmiObj = {
      name: member.nickName,
      type: 'line',
      smooth: true,
      data: [],
      yAxisIndex:1,
      connectNulls: true
    }
    var arr = new Array(xData.length);
    arr.fill(null);
    var bimData = new Array(xData.length);
    bimData.fill(null);
    for (var record of records) {
      if (record.weight) {
        arr[parseInt(record.date.substr("8")) - 1] = record.weight
        if (member.height) {
          var weight = record.weight;
          var height = member.height;
          if (!member.kgFlag) {
            weight = weight / 2
          }
          var BMI = weight / (height * height / 10000);
          bimData[parseInt(record.date.substr("8")) - 1] = BMI.toFixed(2)
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
      if(width == 0 && height ==0){
        setTimeout(() => {
          console.log("获取canvas对象")
          this.init()
        }, 100)
        return
      }
      chart = echarts.init(canvas, null, {
        width: width,
        height: height
      });
      if(this.data.showBmi){
        setOption(chart, seriesBmiData);
      }else{
        setOption(chart, seriesData);
      }
      // 将图表实例绑定到 this 上，可以在其他成员函数（如 dispose）中访问
      this.chart = chart;
      // 注意这里一定要返回 chart 实例，否则会影响事件处理等
      return chart;
    });
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function (res) {
    return {
      title: '嗨~来和我一起PK打卡吗',
      path: '/pages/pk/pk?id='+ this.data.pk._id,
      success: function (res) {
        // 转发成功
        wx.showToast({
          title: '发送邀请成功',
        })
      },
      fail: function (res) {
        // 转发失败
      }
    }
  },
  
})