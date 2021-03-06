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
        console.log(pos, params, dom, rect, size)
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
          return parseInt(value.min - 10);
        }
      }
    ],
    series: series
  };
  console.log(option)
  chart.setOption(option);
}


let chart = null
Page({

  /**
   * 页面的初始数据
   */
  data: {
    pk: {},
    show: false,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    isPKOwner: false,
    visibleInviteDialog: false,
    ec: {
      // 将 lazyLoad 设为 true 后，需要手动初始化图表
      lazyLoad: true
    },
    titleFlag: true,
    currentDate: new Date().getTime(),
    maxDate: new Date().getTime(),
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
      if(!options){
        return;
      }
      // 如果是别人邀请近来的用户，首选获取pk信息，并查询chart数据；然后查询有没有用户信息，没有注册过的用户会提示授权；
      if (options && options.id) {
        var id = decodeURIComponent(options.id);
        CF.get("pk", { _id: id }, (e) => {
          this.setData({
            pk: e.result.data[0]
          })
          this.requestData(this.data.currentYear + '-' + this.formatMonth(this.data.currentMonth));
        });
        // 查询授权信息
        CF.get("users", {
          openId: true
        }, (e) => {
          App.globalData.userInfo = e.result.data[0] || {};
          this.setData({
            visibleInviteDialog: true,
          })
          this.setOwnerFlag();
        })
      }else{
        var data =  App.globalData.currentPk
        this.setData({
          pk: App.globalData.currentPk
        })
        this.requestData(this.data.currentYear + '-' + this.formatMonth(this.data.currentMonth));
        this.setOwnerFlag();
      };
  },
  setOwnerFlag(){
    if(this.data.pk.openId == App.globalData.userInfo.openId){
      this.setData({
        isPKOwner: true
      })
    }else{
      this.setData({
        isPKOwner: false
      })
    }
  },
  showPopup() {
    this.setData({ show: true });
  },
  clickTitle(){
    this.setData({
      titleFlag: !this.data.titleFlag
    })
    setOption(this.chart, this.data.titleFlag ? seriesData : seriesBmiData)
  },
  deletePk(e){
    var pkID = this.data.pk._id
    wx.showModal({
      title: '提示',
      content: '确定要删除吗?',
      success(res) {
        if (res.confirm) {
          CF.delete("pk", { _id: pkID }, () => {
            wx.switchTab({
              url: '../myInfo/myInfo',
              success: function (res) {
                var page = getCurrentPages().pop();
                if (page == undefined || page == null) return;
                page.onLoad();
              },
              fail: function (res) {
                console.log('跳转到pk列表页面失败')  // fail
              }
            })
          })
        }
      }
    })
  },
  onInput(event) {
    this.setData({
      currentDate: event.detail,
    });
  },
  nextMonth(){
    var currentDate = this.data.currentYear + '-' + this.data.currentMonth
    // 不能选择以后月份
    if(parseInt(this.data.currentYear) == new Date().getFullYear() && 
    parseInt(this.data.currentMonth) == new Date().getMonth() + 1){
      wx.showToast({
        title: '未来月份！',
        image: '../../images/fail.png',
        duration: 2000
      })
      return
    }
    var prevMonth = this.getNextMonth(currentDate)
    var year = prevMonth.split('-')[0]
    var month = prevMonth.split('-')[1]
    this.setData({
      currentYear : year,
      currentMonth : month
    })
    this.requestData(year + '-' + this.formatMonth(month))
  },
  prevMonth() {
    var currentDate = this.data.currentYear + '-' + this.data.currentMonth
    var prevMonth = this.getPrevMonth(currentDate)
    var year = prevMonth.split('-')[0]
    var month = prevMonth.split('-')[1]
    this.setData({
      currentYear : year,
      currentMonth : month
    })
    this.requestData(year + '-' + this.formatMonth(month))
  },
  // 传入格式为2020-6，月份前不能有0
  getPrevMonth(date) {
    var arr = date.split('-');
    var year = arr[0]; //获取当前日期的年份
    var month = arr[1]; //获取当前日期的月份
    if (month == 1) {
        month = 12;
        year = parseInt(year) - 1;
        return year + '-' + month
    }
    else{
        month = parseInt(month) - 1;
        return year + '-' + month
    }
  },
  // 传入格式为2020-6，月份前不能有0
  getNextMonth(date) {
    var arr = date.split('-');
    var year = arr[0]; //获取当前日期的年份
    var month = arr[1]; //获取当前日期的月份
    if (month == 12) {
        month = 1;
        year = parseInt(year) + 1;
        return year + '-' + month
    }
    else{
        month = parseInt(month) + 1;
        return year + '-' + month
    }
  },
  confirmDate(event) {
    var year = new Date(event.detail).getFullYear()
    var month = new Date(event.detail).getMonth() + 1
    this.setData({
      show:false,
      currentYear: year,
      currentMonth: month
    });
    // 获取选定月的减肥数据
    var formatMonth = this.formatMonth(month)
    // console.log(year+'-'+formatMonth)
    this.requestData(year + '-' + formatMonth);
  },
  // 格式化月份，单数月加0
  formatMonth(month){
    if(month < 10){
      return month = '0' + month
    }
    else
      return month
  },
  cancel(event) {
    this.setData({
      show:false,
    });
  },
  leavePk(e){
    if(!App.globalData.userInfo.openId) return;
    var pkID = this.data.pk._id
    var that = this;
    wx.showModal({
      title: '提示',
      content: '确定要退出吗?',
      success(res) {
        if (res.confirm) {
          // 判断是否在组队中
             that.data.pk.members = that.data.pk.members.filter(item => {
              return item.openId != App.globalData.userInfo.openId
            })
            CF.update("pk",{_id: that.data.pk._id},{
              members: that.data.pk.members
            },()=>{
              wx.switchTab({
                url: '/pages/myInfo/myInfo',
                success: function (res) {
                  var page = getCurrentPages().pop();
                  if (page == undefined || page == null) return;
                  page.onLoad();
                },
                fail: function (res) {
                  console.log('跳转到pk列表页面失败')  // fail
                }
              })
            })
          }
      }
    })
  },
  requestData(month){
    // 清空信息
    seriesData.length = 0;
    seriesBmiData.length = 0;
    var member = this.data.pk.members;
    var ajaxArray = [];
    for (let m of member) {
      ajaxArray.push(this.queryRecordsByMonth(month, m.openId))
    }
    wx.showLoading({ title: '加载中...', icon: 'loading' })
    Promise.all(ajaxArray).then((res) => {
      wx.hideLoading();
      res.forEach((item, index) => {
        this.prepareSeriesData(item.result.data, member[index])
      })
      this.initXdata();
      this.init()
    }).catch((e) => {
      console.log("queryRecordsByMonth failed", e)
      wx.hideLoading();
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
    })
  },
  initXdata(){
    xData = []
    var startDay = dayjs(this.data.currentYear+"-"+this.data.currentMonth+"-01")
    var endDate = startDay.endOf('month').date();
    // 是否查询当月
    if(dayjs().format("YYYY-MM") == this.data.currentYear+"-"+(this.data.currentMonth < 10 ? ("0" +　this.data.currentMonth): this.data.currentMonth)){
      endDate = dayjs().date()
    }
    for (var i = 1; i <= endDate; i++) {
      xData.push(this.data.currentMonth + "-" + (i < 10 ? "0" + i : i))
    }
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
    if(e.detail == "confirm"){
      this.data.pk.members.push(App.globalData.userInfo)
      CF.update("pk",{_id: this.data.pk._id},{
        members: this.data.pk.members
      },()=>{
        wx.showToast({
          title: '组队成功',
        })
        this.setData({
          pk: this.data.pk
        })
        this.requestData(this.data.currentYear + '-' + this.formatMonth(this.data.currentMonth));
      })
    }else{
      wx.switchTab({
        url: '/pages/index/index',
      })
    }
  },
  prepareSeriesData(records, member){
    var obj = {
      name: member.nickName,
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: []
    }
    var bmiObj = {
      name: member.nickName,
      type: 'line',
      smooth: true,
      yAxisIndex: 0,
      data: []
    }
    var arr = new Array(xData.length);
    arr.fill(null);
    var bmiData = new Array(xData.length);
    bmiData.fill(null);
    for (var record of records) {
      if (record.weight) {
        arr[parseInt(record.date.substr("8")) - 1] = record.weight
        if (member.height) {
          var weight = record.weight;
          var height = member.height;
          var BMI = weight / 2 / (height * height / 10000);
          bmiData[parseInt(record.date.substr("8")) - 1] = BMI.toFixed(2)
        }
      }
    }
    obj.data = arr;
    bmiObj.data = bmiData;

    seriesData.push(obj)
    seriesBmiData.push(bmiObj)
  },
  /**
  * 按日期查询
  */
  queryRecordsByMonth: function (month, openId) {
    console.log("queryRecords" + month)
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
        this.ecComponent = this.selectComponent('#mychart-dom-line');
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
      setOption(chart, this.data.titleFlag ? seriesData : seriesBmiData);
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
  goBack(){
    wx.switchTab({
      url: '/pages/index/index',
    })
  }
})