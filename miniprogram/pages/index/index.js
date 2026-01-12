/**
 * 体重记录主页面
 * @description 提供体重记录、图表展示、BMI计算等功能
 */
import { cloud as CF } from '../../utils/cloudFunction.js';
import { cloud as CF1 } from '../../utils/cloudFunctionPromise.js';
import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import Notify from '../../miniprogram_npm/@vant/weapp/notify/notify';
import data from './data';
import dataHappy from './dataHappy';

// 获取应用实例
const App = getApp();
const TODAY = dayjs().format("YYYY-MM-DD");
const HOUR = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
const MIN = ['00', '30'];

// 图表数据
let xData = [];
let yData = []; // 体重数据（斤）
let bmiData = []; // BMI数据

/**
 * 格式化日期为日格式（只显示日期，不显示月份）
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @returns {string} 格式化后的日期 DD（日）
 */
function formatDateToMonthDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    // 只返回日期部分，去掉前导0
    return parseInt(parts[2]).toString();
  }
  return dateStr;
}

/**
 * 设置图表配置
 * @param {object} chart - ECharts实例
 */
function setOption(chart) {
  // 格式化横坐标日期，去掉年份
  const formattedXData = xData.map(date => formatDateToMonthDay(date));
  
  // 根据数据点数量自动计算 x 轴标签间隔
  // 由于只显示日期，标签更短，可以显示更多标签
  let xAxisInterval = 0;
  if (formattedXData.length > 20) {
    // 数据点多时，每隔几个显示一个标签，确保最多显示 15 个标签
    xAxisInterval = Math.ceil(formattedXData.length / 15);
  }
  
  // 获取目标体重
  const App = getApp();
  const aimWeight = App.globalData.userInfo?.aimWeight || null;
  
  // 检查是否有有效的BMI数据（至少有一个非null值）
  const hasValidBmiData = bmiData.some(bmi => bmi !== null && bmi !== undefined);
  
  // 计算BMI数据的实际范围（用于动态设置Y轴范围）
  let bmiMin = null;
  let bmiMax = null;
  if (hasValidBmiData) {
    const validBmiValues = bmiData.filter(bmi => bmi !== null && bmi !== undefined);
    if (validBmiValues.length > 0) {
      bmiMin = Math.min(...validBmiValues);
      bmiMax = Math.max(...validBmiValues);
    }
  }
  
  // 构建图例数据
  const legendData = ['体重'];
  if (hasValidBmiData) {
    legendData.push('BMI');
  }
  if (aimWeight) {
    legendData.push('目标体重');
  }
  
  const option = {
    title: {
      text: '本月体重与BMI曲线',
      left: 'center',
      z: 1,
      show: false
    },
    color: ["#37A2DA", "#FF6B6B", "#95E1D3"],
    legend: {
      data: legendData,
      show: true,
      top: 10,
      itemGap: 30
    },
    grid: {
      left: '15%',
      right: '15%',  // 为右侧Y轴留出空间
      top: '20%',
      bottom: '18%',
      containLabel: false
    },
    tooltip: {
      show: true,
      trigger: 'axis',
      formatter: function(params) {
        if (!params || params.length === 0) return '';
        
        // 通过索引从原始 xData 获取完整日期
        const dataIndex = params[0].dataIndex;
        let dateStr = '';
        if (dataIndex >= 0 && dataIndex < xData.length) {
          const fullDate = xData[dataIndex];
          // 格式化为 MM-DD
          if (fullDate) {
            const parts = fullDate.split('-');
            if (parts.length >= 3) {
              dateStr = parts[1] + '-' + parts[2];
            } else {
              dateStr = fullDate;
            }
          }
        }
        
        // 如果没有找到完整日期，使用显示的日期
        if (!dateStr) {
          dateStr = params[0].name || '';
        }
        
        let result = dateStr + '\n';
        
        // 遍历所有系列数据
        params.forEach(function(item) {
          if (item && item.seriesName && item.value !== null && item.value !== undefined) {
            let unit = '';
            if (item.seriesName === '体重') {
              unit = '斤';
            } else if (item.seriesName === 'BMI') {
              unit = '';
            } else if (item.seriesName === '目标体重') {
              unit = '斤';
            }
            result += item.seriesName + ': ' + item.value + unit + '\n';
          }
        });
        
        return result.trim();
      },
      position: function (pos, params, dom, rect, size) {
        // 鼠标在左侧时 tooltip 显示到右侧，鼠标在右侧时 tooltip 显示到左侧
        if (pos[0] < size.viewSize[0] / 2) {
          return { top: pos[1], left: pos[0] + 5 };
        } else {
          return { top: pos[1], right: size.viewSize[0] - pos[0] - 5 };
        }
      },
      backgroundColor: 'rgba(50, 50, 50, 0.9)',
      borderColor: '#333',
      borderWidth: 1,
      textStyle: {
        color: '#fff',
        fontSize: 12
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: formattedXData,
      axisLabel: {
        fontSize: 12,
        color: '#37A2DA',
        fontWeight: 'normal',
        interval: xAxisInterval,
        rotate: 0,
        margin: 8
      },
      axisLine: {
        lineStyle: {
          color: '#37A2DA'
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '体重(斤)',
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: {
          color: '#37A2DA',
          fontSize: 13,
          fontWeight: 'bold'
        },
        position: 'left',
        axisLabel: {
          formatter: '{value}',
          color: '#37A2DA',
          fontSize: 13,
          fontWeight: 'normal'
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#37A2DA'
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed'
          }
        },
        min: function (value) {
          return Math.max(0, parseInt(value.min - 10));
        }
      },
      {
        type: 'value',
        name: 'BMI',
        nameLocation: 'end',
        nameGap: 15,
        nameTextStyle: {
          color: '#FF6B6B',
          fontSize: 13,
          fontWeight: 'bold'
        },
        position: 'right',
        axisLabel: {
          formatter: '{value}',
          color: '#FF6B6B',
          fontSize: 13,
          fontWeight: 'normal'
        },
        axisLine: {
          show: true,
          lineStyle: {
            color: '#FF6B6B'
          }
        },
        splitLine: {
          show: false  // 右侧Y轴不显示分割线，避免与左侧重叠
        },
        min: function (value) {
          // 根据实际BMI数据动态设置最小值
          // 如果传入了计算好的bmiMin，使用它；否则使用ECharts自动计算的值
          const actualMin = bmiMin !== null ? bmiMin : (value.min || 10);
          const actualMax = bmiMax !== null ? bmiMax : (value.max || 30);
          const range = actualMax - actualMin;
          
          // 留出15%的边距，但最小不低于10
          const minValue = Math.max(10, Math.floor(actualMin - range * 0.15));
          return minValue;
        },
        max: function (value) {
          // 根据实际BMI数据动态设置最大值
          // 如果传入了计算好的bmiMax，使用它；否则使用ECharts自动计算的值
          const actualMin = bmiMin !== null ? bmiMin : (value.min || 10);
          const actualMax = bmiMax !== null ? bmiMax : (value.max || 30);
          const range = actualMax - actualMin;
          
          // 留出15%的边距，但最大不超过35
          const maxValue = Math.min(35, Math.ceil(actualMax + range * 0.15));
          return maxValue;
        }
      }
    ],
    series: [
      {
        name: '体重',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 9,
        yAxisIndex: 0,
        lineStyle: {
          width: 3.5,
          color: '#37A2DA'
        },
        itemStyle: {
          color: '#37A2DA',
          borderWidth: 2,
          borderColor: '#fff'
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 3,
            borderColor: '#fff'
          }
        },
        data: yData
      }
    ]
  };
  
  // 添加BMI曲线（如果有有效的BMI数据）
  if (hasValidBmiData) {
    option.series.push({
      name: 'BMI',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 9,
      yAxisIndex: 1,  // 使用右侧Y轴
      lineStyle: {
        width: 3.5,
        color: '#FF6B6B'
      },
      itemStyle: {
        color: '#FF6B6B',
        borderWidth: 2,
        borderColor: '#fff'
      },
      emphasis: {
        focus: 'series',
        itemStyle: {
          borderWidth: 3,
          borderColor: '#fff'
        }
      },
      data: bmiData
    });
  }
  
  // 添加目标体重线（如果有目标体重）
  if (aimWeight) {
    const targetWeightData = new Array(xData.length).fill(aimWeight);
    option.series.push({
      name: '目标体重',
      type: 'line',
      yAxisIndex: 0,  // 使用左侧Y轴
      lineStyle: {
        width: 2,
        color: '#95E1D3',
        type: 'dashed'  // 虚线
      },
      symbol: 'none',  // 不显示点
      data: targetWeightData
    });
  }
  
  App.globalData.option = option;
  chart.setOption(option);
}

let chart = null;
// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

Page({
  data: {
    subscribeChecked: true, // 提醒打卡，默认为true
    reminderTime: dayjs().format("HH:mm"), // 提醒时间，默认为当前时间
    visibleReminderTimePicker: false, // 控制提醒时间选择器显示
    visibleNoticeDialog:false, // 通告弹框
    visibleNoticeBar:false, // 通告 上方 通知栏
    noticeContent:"", // 通告内容
    multiArray:[HOUR, MIN], 
    multiIndex:[10,0],
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
      color: "#8DD8F8",
      left: "分类",
      right: "BMI 范围"
    }, {
        color: "#4A90E2",
        left: "偏瘦",
        right: " <= 18.4"
      }, {
        color: "#34C759",
        left: "正常",
        right: "18.5 ~ 23.9"
      }, {
        color: "#FFCC00",
        left: "过重",
        right: "24.0 ~27.9"
      }, {
        color: "#FF3B30",
        left: "肥胖",
        right: ">= 28.0 "
      }],
    height:"",
    heightInput:0,
    showChange: false,
    visible: false, // 控制模态框的显示
    visibleHeight: false, // 体重输入框
    bmiInfo: "授权查看BMI",
    weight: 0,  // 输入框的value
    weightKg: 0,
    lastWeight: "", // 最新体重
    text: false, // 记录点击日期的体重
    records:[],
    bmiStyle:"",
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
    clockOpen: true,
    clockDate: App.globalData.userInfo.clockDate || "12:00" ,
    confirmButtonText:"保存本地",
    visibleHtml: false,
    htmlImage:"cloud://release-ba24f3.7265-release-ba24f3-1257780911/activity.png",
    currentBMI: null, // 当前BMI值
    bmiMarkerPosition: 0, // BMI在范围条上的位置（百分比）
    currentBMICategory: 0, // 当前BMI所属分类（1-4）
    showYearlyReportEntry: false, // 是否显示年终报告入口
    yearlyReportViewed: false, // 是否已查看过年终报告
    yearlyReportEntryClosed: false, // 是否已关闭首页入口
    floatPosition: { x: 0, y: 0 }, // 悬浮图标位置
    touchStart: { x: 0, y: 0 }, // 触摸起始位置
    isDragging: false // 是否正在拖拽
  },
  showNoticeDialog(){
    this.setData({
      visibleNoticeDialog:true
    })
  },
  closeNoticeDialog(){
    this.setData({
      visibleNoticeDialog:false
    })
  },
  handleClockCancel(e) {
    this.setData({
      visibleClock: false
    })
  },
  handleClockSet(e) {
    console.log(e)
    this.setData({
      visibleClock: false
    })

    if (e.detail != "confirm") { // 点击取消
      return;
    }
    CF.update("users", {
      openId: true
    }, {
      clockDate: this.data.clockDate,
      clockOpen: this.data.clockOpen
    },  () =>{

    App.globalData.userInfo.clockDate = this.data.clockDate
      wx.showToast({
        title: '设置成功',
        icon: 'success',
        duration: 2000
      })
    },() => {
        wx.showToast({
          title: '设置失败，请重试',
          icon: 'none',
          duration: 2000
      })
    })
  },
  onClockDateConfirm(event) {
    console.log(event)
    var hour = event.detail.value[0];
    var min = event.detail.value[1];
    this.setData({
      clockDate: HOUR[hour] + ":" + MIN[min],
    });
  },
  // 获取组件
  onReady: function () {
    this.ecComponent = this.selectComponent('#mychart-dom-line');
  },
  /**
   * 分享生成海报
   */
  showPoster: function(){
    data.views[1].content = "您的好友【 " + (App.globalData.userInfo.nickName || "未授权") + "】";
    
    // 优化：使用更高效的方式查找最小值和最大值
    const weights = this.data.records
      .filter(r => r.weight)
      .map(r => r.weight);
    
    if (weights.length === 0) {
      return;
    }
    
    const max = Math.max(...weights);
    const min = Math.min(...weights);
    const reduce = ((max - min) / 2).toFixed(2);
    const unit = "KG";
    
    data.views[2].content = "在【" + this.data.currentMonth + "】期间体重减少" + reduce + unit + "！";
    data.views[3].url = this.data.canvasImagePath;
    
    this.setData({
      painting: data,
    });
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
    this.setData({
      confirmButtonText: "保存本地"
    })
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
        console.log(res)
        this.data.canvasImagePath = res.tempFilePath;
        this.showPoster()
      },
      fail: res => console.log("333", res)
    });
  }, 

  // 生成红旗头像
  showPhoto(){
    this.setData({
      confirmButtonText: "保存并分享"
    })
    // 选择图片
    var avatarUrl = App.globalData.userInfo.avatarUrl;
    if (!avatarUrl) {
      // 请先授权
      wx.showToast({
        icon: 'none',
        title: '请先授权',
      })
      wx.navigateTo({
        url: '/pages/login/index'
      })
      return;
    }
    wx.showLoading({
      title: '生成头像中...',
    })
    var that = this;
    wx.getUserInfo({
      success: function (res) {
        var userInfo = res.userInfo
        var nickName = userInfo.nickName
        avatarUrl = userInfo.avatarUrl
        avatarUrl = avatarUrl.replace("/132", "/0")
        dataHappy.views[0].url = avatarUrl
        console.log(dataHappy)
        that.setData({
          painting: dataHappy,
        })
      }
    })

  },
  onClockOpenChange(event) {
    // 需要手动对 clockOpen 状态进行更新
    this.setData({ clockOpen: event.detail });
  },
  onShareAppMessage(options){
    var that = this;
　　// 设置菜单中的转发按钮触发转发事件时的转发内容
　　var shareObj = {
          title:"打开小程序，点击小红旗，给你一面国旗",        // 默认是小程序的名称(可以写slogan等)
          path:'/pages/start/index',        // 默认是当前页面，必须是以'/'开头的完整路径
  　　　　imageUrl: this.data.fileid,     //自定义图片路径，可以是本地文件路径、代码包文件路径或者网络图片路径，支持PNG及JPG，不传入 imageUrl 则使用默认截图。显示图片长宽比是 5:4
  　　　　success:function (res) {
    　　　　　　// 转发成功之后的回调
    　　　　　　if (res.errMsg == 'shareAppMessage:ok') {
    　　　　　　}
  　　　　},
  　　　　fail:function () {
    　　　　　　// 转发失败之后的回调
    　　　　　　if (res.errMsg == 'shareAppMessage:fail cancel') {
      　　　　　　　　// 用户取消转发
    　　　　　　} else if (res.errMsg == 'shareAppMessage:fail') {
      　　　　　　　　// 转发失败，其中 detail message 为详细失败信息
    　　　　　　}
  　　　　},
  　　　　complete:function(){
    　　　　　　// 转发结束之后的回调（转发成不成功都会执行）
  　　　　}
  　　}
　　// 返回shareObj
    // 来自页面内的按钮的转发
　　if (options.from != 'button') {
      shareObj.title = "快来和我一起打卡，记录体重变化吧";
　　}
　　return shareObj;
  },
  // 点击按钮后初始化图表（优化：避免重复初始化）
  init: function () {
    // 如果图表已存在且已初始化，直接更新数据
    if (this.chart && this.data.isLoaded) {
      setOption(this.chart);
      return;
    }
    
    if (!this.ecComponent){
      setTimeout(() =>{
        console.log("获取canvas对象")
        this.init()
      },100)
      return
    }
    this.ecComponent.init((canvas, width, height, dpr) => {
      // 获取组件的 canvas、width、height、dpr 后的回调函数
      // 在这里初始化图表
      if (!canvas) {
        console.error('Canvas 初始化失败');
        return;
      }
      
      // 如果图表已存在，先销毁
      if (this.chart) {
        this.chart.dispose();
      }
      
      // 使用设备像素比，提升高清屏显示效果
      const finalDpr = dpr || 2;
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: finalDpr
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
  
  /**
   * 销毁图表（页面卸载时调用）
   */
  disposeChart: function() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
      this.setData({
        isLoaded: false,
        isDisposed: true
      });
    }
  },
  onLoad: function(){
    wx.showShareMenu({  menus: ['shareAppMessage', 'shareTimeline']});
    App.initUserInfo(() => {
      this.setData({
        height: App.globalData.userInfo.height || ""
      });
      // 查询当月记录
      this.queryRecordsByMonth(this.data.currentMonth);
      // 查询最新活动
      this.queryLastActivity();
      // 检查是否显示年终报告入口
      this.checkYearlyReportEntry();
    });
  },
  
  /**
   * 检查是否显示年终报告入口（仅在2026年1月30日之前显示，且2025年至少有2条打卡记录）
   */
  checkYearlyReportEntry: function() {
    const deadline = dayjs('2026-01-30');
    const now = dayjs();
    const isBeforeDeadline = now.isBefore(deadline);
    
    // 如果不在时间范围内，直接不显示
    if (!isBeforeDeadline) {
      this.setData({
        showYearlyReportEntry: false
      });
      return;
    }
    
    // 检查本地是否已查看过报告
    try {
      const viewed = wx.getStorageSync('yearlyReport2025Viewed');
      this.setData({
        yearlyReportViewed: !!viewed
      });
    } catch (e) {
      console.error('读取本地存储失败:', e);
    }
    
    // 检查本地是否已关闭首页入口
    try {
      const closed = wx.getStorageSync('yearlyReport2025EntryClosed');
      this.setData({
        yearlyReportEntryClosed: !!closed
      });
    } catch (e) {
      console.error('读取本地存储失败:', e);
    }
    
    // 读取悬浮图标位置
    try {
      const savedPosition = wx.getStorageSync('yearlyReportFloatPosition');
      if (savedPosition && savedPosition.x !== undefined && savedPosition.y !== undefined) {
        this.setData({
          floatPosition: savedPosition
        });
      } else {
        // 默认位置：中部右侧（使用rpx单位）
        const systemInfo = wx.getSystemInfoSync();
        const pixelRatio = 750 / systemInfo.windowWidth; // rpx与px的转换比例
        const screenHeight = systemInfo.windowHeight * pixelRatio; // 屏幕高度（rpx）
        const iconWidth = 140; // 图标宽度（rpx）
        const iconHeight = 100; // 图标高度（rpx）
        
        // 中部右侧：距离右边30rpx，垂直居中
        const defaultX = 750 - iconWidth - 30; // 距离右边30rpx
        const defaultY = (screenHeight - iconHeight) / 2; // 垂直居中
        this.setData({
          floatPosition: { x: defaultX, y: defaultY }
        });
      }
    } catch (e) {
      console.error('读取悬浮图标位置失败:', e);
      // 使用默认位置：中部右侧
      try {
        const systemInfo = wx.getSystemInfoSync();
        const pixelRatio = 750 / systemInfo.windowWidth;
        const screenHeight = systemInfo.windowHeight * pixelRatio;
        const iconWidth = 140;
        const iconHeight = 100;
        const defaultX = 750 - iconWidth - 30;
        const defaultY = (screenHeight - iconHeight) / 2;
        this.setData({
          floatPosition: { x: defaultX, y: defaultY }
        });
      } catch (err) {
        // 如果获取系统信息失败，使用固定值（假设屏幕高度1334rpx）
        const defaultX = 580; // 750 - 140 - 30
        const defaultY = 617; // (1334 - 100) / 2
        this.setData({
          floatPosition: { x: defaultX, y: defaultY }
        });
      }
    }
    
    // 检查2025年是否有至少2条打卡记录
    wx.cloud.callFunction({
      name: 'getYearlyReport',
      data: {
        year: '2025'
      }
    }).then((res) => {
      if (res.result.errCode) {
        // 查询失败，不显示入口
        this.setData({
          showYearlyReportEntry: false
        });
        return;
      }
      
      const records = res.result.records || [];
      // 至少需要2条打卡记录才显示入口
      const hasEnoughRecords = records.length >= 2;
      
      this.setData({
        showYearlyReportEntry: hasEnoughRecords
      });
    }).catch((err) => {
      console.error('检查年终报告入口失败:', err);
      // 查询失败，不显示入口
      this.setData({
        showYearlyReportEntry: false
      });
    });
  },
  
  /**
   * 跳转到年终报告页面
   */
  goToYearlyReport: function() {
    wx.navigateTo({
      url: '/pages/yearlyReport/yearlyReport?year=2025'
    });
  },
  
  /**
   * 关闭首页年度报告入口
   */
  closeYearlyReportEntry: function() {
    wx.showModal({
      title: '提示',
      content: '关闭后可在"我的"页面查看年度报告',
      confirmText: '确定关闭',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.setStorageSync('yearlyReport2025EntryClosed', true);
            this.setData({
              yearlyReportEntryClosed: true
            });
            wx.showToast({
              title: '已关闭',
              icon: 'success',
              duration: 1500
            });
          } catch (e) {
            console.error('保存关闭状态失败:', e);
          }
        }
      }
    });
  },
  
  /**
   * 悬浮图标触摸开始
   */
  onFloatTouchStart: function(e) {
    const touch = e.touches[0];
    this.setData({
      touchStart: {
        x: touch.clientX,
        y: touch.clientY
      },
      isDragging: false
    });
  },
  
  /**
   * 悬浮图标触摸移动（使用节流优化性能）
   */
  onFloatTouchMove: function(e) {
    if (!this._throttledTouchMove) {
      this._throttledTouchMove = throttle((touch) => {
        const deltaX = touch.clientX - this.data.touchStart.x;
        const deltaY = touch.clientY - this.data.touchStart.y;
        
        // 如果移动距离超过10px，认为是拖拽
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          if (!this.data.isDragging) {
            this.setData({
              isDragging: true
            });
          }
          
          // 获取系统信息，用于计算屏幕尺寸（px转rpx）
          const systemInfo = wx.getSystemInfoSync();
          const pixelRatio = 750 / systemInfo.windowWidth; // rpx与px的转换比例
          const iconWidth = 140; // 图标宽度（rpx）
          const iconHeight = 100; // 图标高度（rpx）
          
          // 将px转换为rpx
          const deltaXRpx = deltaX * pixelRatio;
          const deltaYRpx = deltaY * pixelRatio;
          
          let newX = this.data.floatPosition.x + deltaXRpx;
          let newY = this.data.floatPosition.y + deltaYRpx;
          
          // 限制在屏幕范围内（rpx单位，标准宽度750rpx）
          const maxX = 750 - iconWidth;
          const maxY = systemInfo.windowHeight * pixelRatio - iconHeight;
          
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
          
          this.setData({
            floatPosition: { x: newX, y: newY },
            touchStart: {
              x: touch.clientX,
              y: touch.clientY
            }
          });
        }
      }, 16); // 约60fps
    }
    
    const touch = e.touches[0];
    this._throttledTouchMove(touch);
  },
  
  /**
   * 悬浮图标触摸结束
   */
  onFloatTouchEnd: function(e) {
    if (this.data.isDragging) {
      // 保存位置
      try {
        wx.setStorageSync('yearlyReportFloatPosition', this.data.floatPosition);
      } catch (e) {
        console.error('保存悬浮图标位置失败:', e);
      }
      this.setData({
        isDragging: false
      });
    }
  },
  
  /**
   * 页面卸载时清理资源
   */
  onUnload: function() {
    this.disposeChart();
  },
  // 关闭noticeBar
  onNotiveCloseIcon(){
    console.log("onCloseNotice")
    CF.update("users",{openId: true},{
      cuurentNoticeVersion:this.data.noticeVersion
    })
  },
  queryLastActivity(){
    CF.get("notice", {}, (res) => {
      if(res.result && res.result.data){
        var notice = res.result.data[0];
        if(!App.globalData.userInfo || !App.globalData.userInfo.cuurentNoticeVersion  ||  App.globalData.userInfo.cuurentNoticeVersion <notice.version ){
          this.data.noticeVersion = notice.version;
          this.setData({
            visibleNoticeBar:true,
            noticeContent: notice.content,
            noticeImage: notice.image
          })
        }
      }
    })
  },
  showBmiInfo: function(){
    wx.showModal({
      content: 'BMI指数（英文为Body Mass Index，简称BMI），是用体重公斤数除以身高米数平方得出的数字，是目前国际上常用的衡量人体胖瘦程度以及是否健康的一个标准。当我们需要比较及分析一个人的体重对于不同高度的人所带来的健康影响时，BMI值是一个中立而可靠的指标。',
      showCancel:false
    })
  },
  /**
   * 格式化月份
   * @param {number} year - 年份
   * @param {number} month - 月份（1-12）
   * @returns {string} 格式化后的月份字符串 YYYY-MM
   */
  formatMonth: function(year, month) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    return `${year}-${monthStr}`;
  },
  
  /**
   * 点击上个月（优化：合并 setData）
   */
  prevMonth: function (e) {
    const { currentYear, currentMonth } = e.detail;
    const monthStr = this.formatMonth(currentYear, currentMonth);
    // 如果月份相同，不需要更新
    if (this.data.currentMonth === monthStr) {
      return;
    }
    this.setData({
      currentMonth: monthStr
    });
    this.queryRecordsByMonth(monthStr);
  },
  
  /**
   * 点击下个月（优化：合并 setData）
   */
  nextMonth: function (e) {
    const { currentYear, currentMonth } = e.detail;
    const monthStr = this.formatMonth(currentYear, currentMonth);
    // 如果月份相同，不需要更新
    if (this.data.currentMonth === monthStr) {
      return;
    }
    this.setData({
      currentMonth: monthStr
    });
    this.queryRecordsByMonth(monthStr);
  },
  bindchooseDate(e){
    console.log(e)
  },
  /**
   * 点击日期
   */
  selectDate: function(e) {
    console.log(e)
    const date = e.detail.date;
   
    // 如果userInfo.clockClose为true，则忽略此限制
    if(dayjs().isBefore(dayjs(date))){
      if(!App.globalData.userInfo.clockClose){  
        wx.showToast({ title: '不可以选择未来的日期噢...', icon: 'none' })
        return;
      }
    }
    const text = e.detail.text;
    const week = e.detail.week;
    this.setData({
      currentdate: date,
      visible: true,
      text: text,
      weight: parseFloat(text|| 0) ,
      weightKg: parseFloat(text|| 0) / 2 ,
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
  // 生成HTML
  showHTML() {
    this.setData({
      visibleHtml: true
    })
  },
  // 关闭HTML 
  closeHtml: function (e) {
    this.setData({
      visibleHtml: false
    })
    if (e.detail != "confirm") {
      return;
    }
    wx.cloud.downloadFile({
      fileID: this.data.htmlImage, // 文件 ID
      success: res => {
        // 返回临时文件路径
        wx.showToast({
          title: '保存二维码成功',
          icon: 'success',
          duration: 2000
        })
      },
      fail: console.error
    })
  },
  /**
   * 是否选中推送提醒
   */
  onSubscribeCheckboxChange(event){
    this.setData({
      subscribeChecked: event.detail,
    });
  },
  /**
   * 显示提醒时间选择器
   */
  showReminderTimePicker() {
    this.setData({
      visibleReminderTimePicker: true
    });
  },
  /**
   * 确认选择提醒时间
   */
  onReminderTimeConfirm(event) {
    const time = event.detail;
    // 确保时间格式为 HH:mm（两位数），与云函数查询格式一致
    const timeParts = time.split(':');
    const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
    this.setData({
      reminderTime: formattedTime,
      visibleReminderTimePicker: false
    });
  },
  /**
   * 取消选择提醒时间
   */
  onReminderTimeCancel() {
    this.setData({
      visibleReminderTimePicker: false
    });
  },
  handleCloseWeight(){
    this.setData({
      visible: false
    })
  },
  /**
   * 点击提交体重（确定按钮）
   * @param {object} e - 事件对象
   */
  handleInsertWeight: function (e = {}) {
    // 关闭弹窗（优化：先关闭弹窗，提升用户体验）
    this.setData({
      visible: false
    });

    // 如果选中了提醒，请求推送
    if (this.data.subscribeChecked) {
      wx.requestSubscribeMessage({
        tmplIds: ['-ejtsE73bMY5DzlafJoQvPxhkOUklQUP_hZGIMLWzXA'],
        success: (res) => {
          if (res.errMsg === "requestSubscribeMessage:ok") {
            // 使用选择的提醒时间，格式为明天的日期 + 选择的时间
            // 注意：小程序端 dayjs 默认使用本地时间（中国时间 UTC+8）
            // 云函数查询时使用 dayjs().add(8, "hour") 将UTC时间转为中国时间
            // 所以这里直接使用本地时间即可，格式需要与查询时一致
            const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
            // 确保时间格式为 HH:mm（两位数）
            const timeParts = this.data.reminderTime.split(':');
            const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
            const subscribeDate = `${tomorrow} ${formattedTime}`;
            // 插入一条推送记录
            wx.cloud.callFunction({
              name: "updateOrInsert",
              data: {
                tbName: "subscribe",
                query: {
                  openId: true,
                  day: tomorrow
                },
                data: {
                  day: tomorrow,
                  subscribeDate: subscribeDate
                }
              }
            }).catch((err) => {
              console.error('订阅消息记录失败:', err);
            });
          }
        },
        fail: (err) => {
          console.error('订阅消息失败:', err);
        }
      });
    }

    const date = this.data.currentdate;
    const weight = this.data.weight;
    const weightKg = this.data.weightKg;
    
    // 如果体重没有改变且没有上传图片，直接返回
    if (weight == this.data.text && !this.data.refreshFlag) {
      return;
    }

    // 验证体重格式（只有当体重不为空时才验证）
    if (weight) {
      const reg = /^[0-9]+(\.[0-9]{1,2})?$/;
      if (!reg.test(String(weight))) {
        wx.showToast({
          title: '最多两位小数，请检查格式',
          icon: 'none',
          duration: 2000
        });
        this.setData({
          visible: true
        });
        return;
      }
    }

    // 判断是新增、更新还是删除
    const hasRecord = this.data.days[date] || this.data.refreshFlag;
    
    if (hasRecord) {
      // 如果体重为空且没有图片，则删除记录
      if (!weight && !this.data.refreshFlag && !this.data.days[date].fileid) {
        CF.delete("records", {
          openId: true,
          date: date,
        }, () => {
          this.refreshRecords();
        }, (err) => {
          console.error('删除记录失败:', err);
        });
      } else {
        // 更新记录
        CF.update("records", {
          openId: true,
          date: date,
        }, {
          weight: parseFloat(weight) || 0,
          weightKg: parseFloat(weightKg) || 0
        }, () => {
          this.refreshRecords();
        }, (err) => {
          console.error('更新记录失败:', err);
        });
      }
    } else {
      // 新增记录
      CF.insert("records", {
        date: date,
        weight: parseFloat(weight) || 0,
        weightKg: parseFloat(weightKg) || 0
      }, () => {
        this.refreshRecords();
      }, (err) => {
        console.error('插入记录失败:', err);
      });
    }
  },
  
  /**
   * 刷新记录（统一处理刷新逻辑，优化：防抖处理）
   */
  refreshRecords: function() {
    // 防抖处理，避免频繁刷新，且不显示 loading（因为用户可能正在操作）
    if (!this._debouncedRefresh) {
      this._debouncedRefresh = debounce(() => {
        this.queryRecordsByMonth(this.data.currentMonth, false, false);
      }, 300);
    }
    this._debouncedRefresh();
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
      })
      return;
    }
    // 输入数据
    var height = this.data.height
    if (height) {
      CF.update("users", {
        openId: true
      }, {
          height: parseFloat(height)
      }, () => {
        App.globalData.userInfo.height = height;
        this.getBMI()
      })
    }
  },
  /**
   * 按日期查询（优化：减少不必要的 loading）
   * @param {string} month - 月份，格式：YYYY-MM
   * @param {boolean} needLastRecord - 是否需要查询最新体重记录（默认true）
   * @param {boolean} showLoading - 是否显示加载提示（默认true）
   */
  queryRecordsByMonth: function(month, needLastRecord = true, showLoading = true){
    console.log("queryRecordsByMonth", month);
    
    // 防止重复请求
    if (this._isQuerying) {
      console.log("正在查询中，跳过重复请求");
      return;
    }
    this._isQuerying = true;
    
    if (showLoading) {
      wx.showLoading({title: '加载中...', icon: 'loading'});
    }
    
    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: month
      }
    }).then((e) => {
      console.log("queryRecordsByMonth success");
      if (showLoading) {
        wx.hideLoading();
      }
      this._isQuerying = false;
      
      const records = e.result.data || [];
      this.showWeightRecords(records);
      this.updateTodayPunchButton();
      
      // 从当前月份记录中获取最新体重，避免额外请求
      if (needLastRecord) {
        this.updateLastWeightFromRecords(records);
      }
    }).catch((err) => {
      console.error("queryRecordsByMonth failed", err);
      if (showLoading) {
        wx.hideLoading();
      }
      this._isQuerying = false;
      wx.showToast({ 
        title: '网络出小差了,请稍后再试...', 
        icon: 'none',
        duration: 2000
      });
    });
  },
  
  /**
   * 从记录中更新最新体重（避免额外请求）
   * @param {array} records - 体重记录数组
   */
  updateLastWeightFromRecords: function(records) {
    if (records && records.length > 0) {
      // 按日期排序，获取最新的体重记录
      const sortedRecords = records
        .filter(r => r.weight)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      if (sortedRecords.length > 0) {
        const lastWeight = sortedRecords[0].weight;
        this.setData({
          lastWeight: lastWeight
        });
        this.getBMI();
        return;
      }
    }
    // 如果没有记录，仍然调用接口查询
    this.queryLastRecord();
  },
  updateTodayPunchButton: function() {
    const today = dayjs().format("YYYY-MM-DD");
    const isCurrentMonth = this.data.currentMonth === dayjs().format("YYYY-MM");
    const hasTodayRecord = !!this.data.days[today];
    this.setData({
      showTodayPunchButton: isCurrentMonth && !hasTodayRecord
    });
  },
  handleTodayPunch: function() {
    this.selectDate({
      detail: {
        date: dayjs().format("YYYY-MM-DD")
      }
    })
  },
  /**
   * 展示体重数据到日历中（优化版本）
   * @param {array} records - 体重记录数组
   */
  showWeightRecords: function (records) {
    const mystatus = new Array(31).fill(null);
    this.data.days = {};
    xData = [];
    yData = [];
    bmiData = [];  // 重置BMI数据
    
    // 用于跟踪上一个体重
    let lastWeight = null;
    
    // 缓存BMI计算所需的值，避免重复获取
    const height = App.globalData.userInfo.height || this.data.height;
    const hasHeight = !!height;

    records.forEach((record) => {
      this.data.days[record.date] = record;
      record.text = record.weight;
      
      // 标记有图片的日期
      if (record.fileid) {
        const dayIndex = parseInt(record.date.substring(8)) - 1;
        if (dayIndex >= 0 && dayIndex < 31) {
          mystatus[dayIndex] = 1;
        }
      }
      
      // 处理有体重数据的记录
      if (record.text) {
        xData.push(record.date);
        yData.push(record.text);

        // 计算BMI（如果有身高）
        if (hasHeight && height) {
          const weightKg = record.text / 2;  // 转换为千克
          const bmi = weightKg / (height * height / 10000);
          bmiData.push(parseFloat(bmi.toFixed(2)));
        } else {
          bmiData.push(null);  // 没有身高时，BMI为null
        }

        // 根据体重变化设置背景颜色
        if (lastWeight !== null) {
          if (record.text > lastWeight) {
            record.textBgcolor = 'red'; // 体重上涨
          }
        } else {
          record.textBgcolor = 'red'; // 默认红色
        }

        lastWeight = record.text;
      }
    });
    
    // 标记今天（优化：使用更高效的方式）
    const currentMonthStr = dayjs().format("YYYY-MM");
    const isCurrentMonth = this.data.currentMonth === currentMonthStr;
    if (this.data.days[TODAY]) {
      const todayIndex = records.findIndex(r => r.date === TODAY);
      if (todayIndex >= 0) {
        records[todayIndex].background = "#188be4";
      }
    } else if (isCurrentMonth) {
      records.push({
        date: TODAY,
        background: "#188be4"
      });
    }
    
    this.data.records = records;
    
    // 合并 setData，减少渲染次数
    const updateData = {
      mystatus: mystatus,
      speciallist: records,
      hiddenChart: xData.length === 0
    };
    
    // 如果图表已初始化，只更新数据，不重新初始化
    if (this.chart && xData.length > 0) {
      setOption(this.chart);
      this.setData(updateData);
    } else {
      // 图表未初始化或没有数据，需要初始化
      this.setData(updateData);
      if (xData.length > 0) {
        // 延迟初始化图表，避免阻塞渲染
        wx.nextTick(() => {
          this.init();
        });
      }
    }
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
  /**
   * 计算BMI指数
   * @param {number} weight - 体重（斤）
   * @param {number} height - 身高（cm）
   * @returns {object} {bmi: number, bmiInfo: string, bmiStyle: string}
   */
  calculateBMI: function(weight, height) {
    if (!weight || !height) {
      return null;
    }
    
    // 转换为kg
    const weightKg = weight / 2;
    const bmi = weightKg / (height * height / 10000);
    
    // 根据BMI值确定分类
    let bmiInfo = '';
    let bmiStyle = '';
    const bmiValue = parseFloat(bmi.toFixed(2));
    
    if (bmiValue <= 18.4) {
      bmiInfo = `${bmiValue} (${this.data.tips[1].left})`;
      bmiStyle = `color: ${this.data.tips[1].color}`;
    } else if (bmiValue < 24) {
      bmiInfo = `${bmiValue} (${this.data.tips[2].left})`;
      bmiStyle = `color: ${this.data.tips[2].color}`;
    } else if (bmiValue < 28) {
      bmiInfo = `${bmiValue} (${this.data.tips[3].left})`;
      bmiStyle = `color: ${this.data.tips[3].color}`;
    } else {
      bmiInfo = `${bmiValue} (${this.data.tips[4].left})`;
      bmiStyle = `color: ${this.data.tips[4].color}`;
    }
    
    return { bmi: bmiValue, bmiInfo, bmiStyle };
  },
  
  /**
   * 更新BMI显示（优化：减少 setData 调用）
   */
  getBMI: function () {
    let bmiInfo = "";
    let bmiStyle = "";
    
    // 检查授权
    if (!App.globalData.userInfo.avatarUrl) {
      bmiInfo = "点击授权查看BMI";
    }
    // 检查身高
    else if (!this.data.height) {
      bmiInfo = "点击设置身高";
    }
    // 检查体重
    else if (!this.data.lastWeight) {
      bmiInfo = "点击日历设置体重";
    }
    // 计算BMI
    else {
      const bmiResult = this.calculateBMI(this.data.lastWeight, this.data.height);
      if (bmiResult) {
        this.data.BMI = bmiResult.bmi;
        bmiInfo = bmiResult.bmiInfo;
        bmiStyle = bmiResult.bmiStyle;
      }
    }
    
    // 只在值变化时更新
    if (bmiInfo && (this.data.bmiInfo !== bmiInfo || this.data.bmiStyle !== bmiStyle)) {
      this.setData({
        bmiInfo: bmiInfo,
        bmiStyle: bmiStyle
      });
    }
  },
  /**
   * 体重输入框
   */
  onChangeWeight: function(e){
    this.setData({
      weight: e.detail,
      weightKg: (e.detail / 2).toFixed(2)
    })
  },
  onChangeWeightKg: function(e){
    this.setData({
      weightKg: e.detail,
      weight: e.detail * 2
    })
  },
  /**
   * 身高输入框
   */
  onChangeHeight: function (e) {
    this.setData({height: e.detail})
  },
  changeHeight: function(e){
    if (App.globalData.userInfo.avatarUrl) {
      this.setData({
        visibleHeight: true
      });
    } else {
      wx.showToast({
        icon: 'none',
        title: '请先授权',
        duration: 2000
      });
      wx.navigateTo({
        url: '/pages/login/index'
      });
    }
  },
  /**
   * 显示BMI提示弹框
   */
  showBmiTip: function () {
    // 计算当前BMI的位置和分类
    let bmiMarkerPosition = 0;
    let currentBMICategory = 0;
    let currentBMI = null;
    
    if (this.data.BMI) {
      currentBMI = parseFloat(this.data.BMI);
      const bmiValue = currentBMI;
      
      // 确定BMI分类
      if (bmiValue <= 18.4) {
        currentBMICategory = 1;
        // 偏瘦范围：0-18.4，均分后占第一个25%
        // 假设BMI范围是0-40，18.4占18.4/40 = 46%，在第一个25%区间内
        bmiMarkerPosition = (bmiValue / 18.4) * 25;
      } else if (bmiValue < 24) {
        currentBMICategory = 2;
        // 正常范围：18.5-23.9，占第二个25%
        const normalStart = 18.5;
        const normalEnd = 23.9;
        const normalRange = normalEnd - normalStart;
        bmiMarkerPosition = 25 + ((bmiValue - normalStart) / normalRange) * 25;
      } else if (bmiValue < 28) {
        currentBMICategory = 3;
        // 过重范围：24.0-27.9，占第三个25%
        const overweightStart = 24.0;
        const overweightEnd = 27.9;
        const overweightRange = overweightEnd - overweightStart;
        bmiMarkerPosition = 50 + ((bmiValue - overweightStart) / overweightRange) * 25;
      } else {
        currentBMICategory = 4;
        // 肥胖范围：>=28，占第四个25%
        // 假设最大显示到40
        const obeseStart = 28;
        const maxDisplayBMI = 40;
        const obeseRange = maxDisplayBMI - obeseStart;
        const positionInObese = Math.min((bmiValue - obeseStart) / obeseRange, 1);
        bmiMarkerPosition = 75 + positionInObese * 25;
      }
      
      // 限制在0-100%范围内
      bmiMarkerPosition = Math.max(0, Math.min(100, bmiMarkerPosition));
    }
    
    this.setData({
      visibleBmi: true,
      currentBMI: currentBMI ? currentBMI.toFixed(2) : null,
      bmiMarkerPosition: bmiMarkerPosition,
      currentBMICategory: currentBMICategory
    });
  },
  /**
   * 检查用户授权
   * @returns {boolean} 是否已授权
   */
  checkUserAuth: function() {
    const openId = App.globalData.userInfo.openId;
    if (!openId) {
      wx.showToast({
        icon: 'none',
        title: '请先授权',
        duration: 2000
      });
      wx.navigateTo({
        url: '/pages/login/index'
      });
      return false;
    }
    return true;
  },
  
  uploadPhoto: function () {
    // 检查授权
    if (!this.checkUserAuth()) {
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
            that.saveImageId(that.data.currentdate, res.fileID);
          },
          fail: e => {
            wx.hideLoading();
            console.error('图片上传失败:', e);
            wx.showToast({
              icon: 'none',
              title: '上传失败',
              duration: 2000
            });
          }
        })
      },
      fail: e => {
        console.error(e)
      }
    })
  },
  /**
   * 显示成功提示
   * @param {string} message - 提示信息
   */
  showSuccessToast: function(message = '操作成功') {
    wx.showToast({
      title: message,
      icon: 'success',
      duration: 2000
    });
  },
  
  saveImageId: function(date, id){
    const hasRecord = this.data.days[date] || this.data.refreshFlag;
    
    if (hasRecord) {
      // 更新记录
      CF.update("records", {
        openId: true,
        date: date
      }, {
        fileid: id
      }, (res) => {
        this.data.days[date].fileid = id;
        // 如果图片正在显示，更新一下图片（重新上传的情况）
        if (this.data.showImage) {
          this.setData({
            fileid: id
          });
        }
        this.showSuccessToast('上传成功');
      }, (err) => {
        console.error('更新图片失败:', err);
      });
    } else {
      // 新增记录
      const obj = {
        weight: "",
        fileid: id,
        date: date
      };
      CF.insert("records", obj, () => {
        this.showSuccessToast('上传成功');
        this.data.days[date] = obj;
      }, (err) => {
        console.error('插入图片失败:', err);
      });
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
    console.log("海报获得图片")
    wx.hideLoading()
    const { tempFilePath, errMsg } = event.detail
    console.log(errMsg)
    if (errMsg === 'canvasdrawer:ok' || errMsg === 'canvasdrawer:samme params') {
      this.setData({
        fileid: tempFilePath || this.data.fileid,
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
    // 检查授权
    if (!this.checkUserAuth()) {
      return;
    }
    
    const clockDate = App.globalData.userInfo.clockDate || "12:00";
    this.setData({
      multiIndex: [clockDate.substring(0, 2), clockDate.substring(3) === "00" ? 0 : 1],
      clockDate: clockDate,
      visibleClock: true
    });
  },
  onShareAppMessage() {
    return {
        title: '记录每一天的变化，一起来打卡吧！',
        path: '/pages/index/index',
        imageUrl: '/images/share-index.png'
    }
  },
})

