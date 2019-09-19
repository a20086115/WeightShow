import { cloud as CF } from '../../utils/cloudFunction.js'
import dayjs from '../../utils/dayjs.min.js'
import * as echarts from '../../ec-canvas/echarts';
import Notify from '../../miniprogram_npm/vant-weapp/notify/notify';
import data from './data'
console.log(data)
//获取应用实例
const App = getApp()
const TODAY = dayjs().format("YYYY-MM-DD");

var xData = [];
var yData = [];
function setOption(chart) {
  var option = {
    title: {
      text: '本月体重曲线',
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
      },
      min: function (value) {
        return parseInt(value.min - 4);
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
    currentMonth: dayjs().format("YYYY-MM"),
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
    bmiInfo: "点击授权查看BMI",
    weight: 0,  // 输入框的value
    lastWeight: "", // 最新体重
    text: false, // 记录点击日期的体重
    records:[],
    kgFlag: true,
    showImage:false,
    fileid: "",
    mystatus:[],
    hiddenChart: true,
    painting: {},
    canvasImagePath: "",
    showActions: false,
    actions: [
      {
        id: "upload",
        name: '重新上传'
      },
      {
        id: "delete",
        name: '删除图片'
      },
      {
        id: "save",
        name: '保存图片'
      }
    ],
    days:{},
    showImageButton: true,
    visibleClock:false,
    visibleDate:false,
    clockOpen: true,
    clockDate:"12:00"
  },

  handleClockSet(e) {
    if (e.detail == "confirm") { // 点击取消
      console.log("shezhi ")
      CF.update("users", {
        openId: true
      }, {
        clockDate: this.data.clockDate,
        clockOpen: this.data.clockOpen
      }, () => {
        wx.showToast({
          title: '设置提醒成功',
          icon: 'success',
          duration: 2000
        })
      })

    }
  },
  onClockDateInput(event) {
    console.log(event)
    this.setData({
      clockDate: event.detail
    });
  },
  onClockDateConfirm(event) {
    console.log(event)
    this.setData({
      clockDate: event.detail,
      visibleDate: false
    });
  },
  onClockDateCancel(event) {
    console.log(event)
    this.setData({
      visibleDate: false
    });
  },
  showDateInput(){
    this.setData({
      visibleDate: true
    });
  },
  onDateClose(){
    this.setData({
      visibleDate: false
    });
  },
  // 获取组件
  onReady: function () {
    this.ecComponent = this.selectComponent('#mychart-dom-line');
  },
  // 分享生成海报
  showPoster:function(){
    data.views[1].content = "您的好友【 " + (App.globalData.userInfo.nickName || "未授权") + "】" 
    var len = this.data.records.length;
    var min = 0;
    var max = 0;
    for(var i = 0; i < len; i++){
      if (!max){
        max = this.data.records[i].weight;
      }
      if (!min){
        min = this.data.records[len - 1 -i].weight;
      }

      if(min && max){
        break
      }
    }
    var unit = App.globalData.userInfo.kgFlag ? "KG" : "斤";
    
    data.views[2].content = "在【" + this.data.currentMonth + "】期间体重狂减" + (max - min).toFixed(2) + unit + "！" 
    data.views[3].url = this.data.canvasImagePath 
    this.setData({
      painting: data,
    })
  },
  // 判断是否可以生成海报
  canGetPoster: function(){
    if (!xData.length){
      wx.showToast({
        icon:"none",
        title: '至少要有一条数据才可以分享~',
      })
      return false
    }
    return true;
  },
  save() {
    // 判断是否可以生成海报
    if (!this.canGetPoster()){
      return;
    }
    wx.showLoading({
      title: '生成海报中...',
    })
    // 保存图片到临时的本地文件
    this.ecComponent.canvasToTempFilePath({
      success: res => {
        console.log("22222")
        this.data.canvasImagePath = res.tempFilePath;
        this.showPoster()
      },
      fail: res => console.log("333", res)
    });
  }, 
  onChange(event) {
    // 需要手动对 checked 状态进行更新
    this.setData({ kgFlag: event.detail });
  },
  onClockOpenChange(event) {
    // 需要手动对 clockOpen 状态进行更新
    this.setData({ clockOpen: event.detail });
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
    this.setData({
      height: App.globalData.userInfo.height || "",
      kgFlag: App.globalData.userInfo.kgFlag || false
    })
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
    this.queryRecordsByMonth(currentYear + "-" + currentMonth)
    this.setData({
      currentMonth: currentYear + "-" + currentMonth
    })
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
      weight: text || "",
      refreshFlag: false
    })
  },
  handleShowBmi:function(){
    this.setData({
      visibleBmi: false
    })
  },
  downLoadImage:function(e){
    this.setData({
      showImage: false
    })
    if (e.detail != "confirm") {
      return;
    }
    if(this.data.fileid.indexOf("cloud") == 0){
      wx.cloud.downloadFile({
        fileID: this.data.fileid, // 文件 ID
        success: res => {
          // 返回临时文件路径
          wx.showToast({
            title: '保存图片成功',
            icon: 'success',
            duration: 2000
          })
        },
        fail: console.error
      })
    }else{
      wx.saveImageToPhotosAlbum({
        filePath: this.data.fileid,
        success(res) {
          wx.showToast({
            title: '保存图片成功',
            icon: 'success',
            duration: 2000
          })
        }
      })
    }
  },
  /**
   * 点击提交体重
   */
  handleInsertWeight: function (e) {
    this.setData({
      visible: false
    })
    if (e.detail != "confirm") { // 点击取消
      if(this.data.refreshFlag){  // 如果上传了图片，即使点击取消，图片依然上传了， 需要刷新
        this.queryRecordsByMonth(this.data.currentMonth)
      }
      return;
    }
    var date = this.data.currentdate;
    var weight = this.data.weight;
    if(weight == this.data.text){
      // 较之前没有改变
      if (this.data.refreshFlag) {
        this.queryRecordsByMonth(this.data.currentMonth)
      }
      return;
    }

    var reg = /^[0-9]+(\.[0-9]{1,2})?$/;
    if(!reg.test(weight) && weight){
      wx.showToast({
        title: '最多两位小数，请检查格式',
        icon: 'none',
        duration: 2000
      })
      this.setData({
        visible: true
      })
      return;
    }
    if (this.data.days[date] || this.data.refreshFlag) {   // 之前已经有值
      if (!weight && !this.data.refreshFlag && !this.data.days[date].fileid) {
        console.log("delete")
        CF.delete("records", {
          openId: true,
          date: date,
        }, () => {
          this.queryRecordsByMonth(this.data.currentMonth)
        })
      }else{
        CF.update("records", {
          openId: true,
          date: date,
        }, {
          weight: weight
        }, () => {
            this.queryRecordsByMonth(this.data.currentMonth)
        })
      }
    }else{
      console.log("insert")
      CF.insert("records", {
        date: date,
        weight: weight
      }, () => {
        this.queryRecordsByMonth(this.data.currentMonth)
      })
    }
  },

  /**
 * 点击提交身高
 */
  handleInsertHeight: function (e) {
    this.setData({
      visibleHeight: false
    })
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
        this.getBMI()
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
      this.showWeightRecords(e.result.data)
      // 查询最新体重
      this.queryLastRecord();
    }).catch(() => {
      console.log("queryRecordsByMonth failed")
      wx.hideLoading();
      wx.showToast({ title: '网络出小差了,请稍后再试...', icon: 'none' })
      this.queryRecordsByMonth(month)
    })
  },
  /**
  * 展示体重数据到日历中
  */
  showWeightRecords: function (records) {
    var specialist = [];
    var mystatus = new Array(31);
    this.data.days = {}
    mystatus.fill(null);
    xData = [];
    yData = [];
    for (var record of records) {
      this.data.days[record.date] = record;
      record.text = record.weight;
      if (record.fileid) {
        mystatus[record.date.substring(8) - 1] = 1;
      }
      if (record.text) {
        xData.push(record.date);
        yData.push(record.text);
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
  getBMI: function () {
    var weight = this.data.lastWeight;
    var height = this.data.height;
    console.log("getBMI", weight, height)
    
    if(!this.data.kgFlag){
      weight = weight/2
    }

    if (!App.globalData.userInfo.avatarUrl) {
      this.setData({
        bmiInfo: "点击授权查看BMI"
      })
      return;
    }
    if (!height){
      this.setData({
        bmiInfo: "点击设置身高"
      })
      return;
    }
    if (!weight) {
      this.setData({
        bmiInfo: "点击日历设置体重"
      })
      return;
    }
    var BMI = weight / (height * height / 10000);
    this.data.BMI = BMI.toFixed(2);
    this.setData({
      bmiInfo: "BMI指数：" + BMI.toFixed(2)
    })

  },
  /**
   * 体重输入框
   */
  onChangeWeight: function(e){
    this.setData({weight: e.detail})
  },
  /**
   * 身高输入框
   */
  onChangeHeight: function (e) {
    this.setData({height: e.detail})
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
  },
  uploadPhoto: function () {
    // 选择图片
    var openId = App.globalData.userInfo.openId;
    if(!openId){
      // 请先授权
      wx.showToast({
        icon: 'none',
        title: '请先授权',
      })
      return;
    }
    // 判断是否有照片， 有则显示，没有则上传
    var currentdate = this.data.currentdate;
    if (this.data.days[currentdate] && this.data.days[currentdate].fileid){
      this.setData({
        fileid: this.data.days[currentdate].fileid,
        showImage: true,
        showImageButton: false
      })
    }else{
      // 上传照片
      this.chooseImage();
    }
  
  },
  chooseImage() {

    var openId = App.globalData.userInfo.openId;
    var that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        wx.showLoading({
          title: '上传中',
        })

        const filePath = res.tempFilePaths[0]
        that.setData({
          imgUrl: filePath
        })
        // 上传图片
        const cloudPath = openId + "/" + that.data.currentdate + "_" + new Date().getTime() + filePath.match(/\.[^.]+?$/)[0]

        console.log(cloudPath)
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: res => {
            wx.hideLoading()
            console.log('[上传文件] 成功：', cloudPath, res)
            // 保存到记录中去
            that.saveImageId(that.data.currentdate, res.fileID)
          },
          fail: e => {
            wx.hideLoading()
            wx.showToast({
              icon: 'none',
              title: '上传失败',
            })
          }
        })
      },
      fail: e => {
        console.error(e)
      }
    })
  },
  saveImageId: function(date, id){
    // 判断一下是新增 还是 修改
    console.log(this.data)
    if (this.data.days[date] || this.data.refreshFlag) {   // 之前已经有值
      console.log("saveImageId, update")
      CF.update("records", {
        openId: true,
        date: date
      }, {
          fileid: id
      },  (res) => {
        this.data.days[date].fileid = id;
        if(this.data.showImage){ // 如果图片正在显示， 更新一下图片。 此情况发生于重新上传的时候
          this.setData({
            fileid: id
          })
        }
         wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 2000
        })
        console.log("修改成功", res)
      })
    }else{
      console.log("saveImageId, insert")
      var obj = {
        weight: "",
        fileid: id,
        date: date
      }
      CF.insert("records", obj, (res) => {
        console.log("修改成功", res)
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 2000
        })
        this.data.days[date] = obj;
      })
    }
    this.data.refreshFlag = true;
  },
  hideImage: function(){
    this.setData({
      showImage: false
    })
  },
  // 海报获得图片
  eventGetImage(event) {
    wx.hideLoading()
    const { tempFilePath, errMsg } = event.detail
    if (errMsg === 'canvasdrawer:ok') {
      this.setData({
        fileid: tempFilePath,
        showImage: true,
        showImageButton: true
      })
    }
  },
  // 长按图片
  longTapImage(){
    if (!this.data.showImageButton){
      this.setData({
        showActions: true
      })
    }
  },
  onClose() {
    console.log("close")
    this.setData({ showActions: false });
  },

  onSelect(event) {
    console.log(event.detail);
    switch(event.detail.id){
      case "upload": // 重新上传
        this.chooseImage();
        break;

      case "delete": // 删除图片
        console.log(event.detail);
        CF.update("records", {
          openId: true,
          date: this.data.currentdate,
        }, {
          fileid: ""
        }, () => {
          this.data.days[this.data.currentdate].fileid = ""
          this.setData({ showImage: false, refreshFlag: true });
        })
        break;

      case "save": // 下载图片

        wx.cloud.downloadFile({
          fileID: this.data.days[this.data.currentdate].fileid, // 文件 ID
          success: res => {
            // 返回临时文件路径
            wx.showToast({
              title: '保存图片成功',
              icon: 'success',
              duration: 2000
            })
          },
          fail: console.error
        })
        break;
    }
    this.setData({ showActions: false });
  },
  clockSet(){
    this.setData({ visibleClock: true });
  }
})

