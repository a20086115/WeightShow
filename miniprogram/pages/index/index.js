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
      text: '本月曲线走势',
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
        return value.min - 10;
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
    bmiInfo: "点击授权查看BMI指数",
    weight: 0,  // 输入框的value
    lastWeight: "", // 最新体重
    text: false, // 记录点击日期的体重
    records:[],
    kgFlag: true,
    showImage:false,
    fileid: "",
    mystatus:[],
    hiddenChart: true,
    painting: data,
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
    // 查询当月记录
    this.queryRecordsByMonth(dayjs().format("YYYY-MM"))

    // Notify({
    //   text:"'防止迷路~记得点击收藏哦'",
    //   backgroundColor:"#1AA7EC"
    // });
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
  /**
   * 点击提交体重
   */
  handleInsertWeight: function (e) {
    this.setData({
      visible: false
    })
    if (e.detail != "confirm") {
      if(this.data.refreshFlag){
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
    if (this.data.text || this.data.refreshFlag || this.data.mystatus[date.substring(8) - 1 ]) {   // 之前已经有值
      console.log("update")
      // 输入数据
      if(weight){
        CF.update("records", {
          openId: true,
          date: date,
        }, {
            weight: weight
          }, () => {
            // this.queryLastRecord()

            this.queryRecordsByMonth(this.data.currentMonth)
            // this.updateRecords(date, weight)
            // this.init()
        })
      }else{ // 未输入数据 ， 将这条记录删除
        CF.delete("records", {
          openId: true,
          date: date,
        }, () => {
            // this.queryLastRecord()
            this.queryRecordsByMonth(this.data.currentMonth)
            // this.deleteRecords(date, weight)
            // this.init()
        })
      }

    }else{
      console.log("insert")
      CF.insert("records", {
        date: date,
        weight: weight
      }, () => {
        this.queryRecordsByMonth(this.data.currentMonth)
        // this.insertRecords(date, weight)
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
      this.setData({
        hiddenChart: e.result.data.length == 0
      })
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
        bmiInfo: "点击授权，查看BMI指数"
      })
      return;
    }
    if (!height){
      this.setData({
        bmiInfo: "点击设置身高，查看BMI指数"
      })
      return;
    }
    if (!weight) {
      this.setData({
        bmiInfo: "点击日历可设置体重，查看BMI指数"
      })
      return;
    }
    var BMI = weight / (height * height / 10000);
    this.setData({
      BMI: BMI.toFixed(2),
      bmiInfo: "您最新的BMI指数为" + BMI.toFixed(2)
    })

  },
  /**
   * 展示体重数据到日历中
   */
  showWeightRecords: function(records){


    this.setData({
      painting: data,
    })
    console.log(data)

    var specialist = [];
    var mystatus = new Array(31);
    mystatus.fill(null);

    xData = [];
    yData = [];
    for(var record of records){
      record.text = record.weight;
      if(record.fileid){
        mystatus[record.date.substring(8) - 1] = 1;
      }
      if(record.text){
        xData.push(record.date);
        yData.push(record.text);
      }
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
      mystatus: mystatus,
      records: records,
      speciallist: records
    })

    console.log(mystatus)
    console.log(records)
    console.log(xData)
    console.log(yData)
    this.init()
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
    var currentdate = this.data.currentdate;
    for(var record of this.data.records){
      if(record.date == currentdate && record.fileid){
        this.setData({
          fileid: record.fileid,
          showImage: true
        })
        return;
      }
    }


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
        const cloudPath = openId + "/"+ that.data.currentdate + filePath.match(/\.[^.]+?$/)[0]

        console.log(cloudPath)
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: res => {
            console.log('[上传文件] 成功：', cloudPath, res)
            wx.showToast({
              title: '上传成功',
            })
            // 保存到记录中去
            that.saveImageId(that.data.currentdate, res.fileID)
          },
          fail: e => {
            console.error('[上传文件] 失败：', e)
            wx.showToast({
              icon: 'none',
              title: '上传失败',
            })
          },
          complete: () => {
            wx.hideLoading()
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
    if (this.data.text) {   // 之前已经有值
      CF.update("records", {
        openId: true,
        date: date
      }, {
          fileid: id
      }, function (res) {
          console.log("修改成功", res)
      })
    }else{
      CF.insert("records", {
        weight: "",
        fileid: id,
        date: date
      }, {
          fileid: id
      }, function (res) {
          console.log("修改成功", res)
      })
    }
    this.data.refreshFlag = true;
    // this.queryRecordsByMonth(this.data.currentMonth)

  },
  hideImage: function(){
    this.setData({
      showImage: false
    })
  },
  eventSave() {
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
  },
  eventGetImage(event) {
    console.log("111111111")
    console.log(event)
    wx.hideLoading()
    const { tempFilePath, errMsg } = event.detail
    if (errMsg === 'canvasdrawer:ok') {
      this.setData({
        fileid: tempFilePath,
        showImage: true
      })
    }
  }
})

