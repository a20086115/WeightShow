import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import { cloud as CF } from '../../utils/cloudFunction.js';
import posterData from './posterData.js';

const App = getApp();

Page({
  data: {
    year: '2025',
    openId: null, // 查看他人报告时的openId，null表示查看自己的报告
    loading: true,
    stats: null,
    records: [],
    ec: {
      lazyLoad: true
    },
    chartData: {
      xData: [],
      yData: []
    },
    encouragementText: '',
    monthlyStatsArray: [], // 月度统计数组
    chartReady: false, // 图表组件是否准备好
    dataReady: false, // 数据是否准备好
    absWeightChange: 0, // 体重变化绝对值（用于显示）
    highlightMonthText: '', // 高光月份文本
    showTargetDialog: false, // 显示目标体重设置弹窗
    targetWeight: '', // 目标体重
    targetWeightLoss: 0, // 需再减的体重
    targetProgress: 0, // 目标进度百分比
    painting: {}, // 海报数据
    canvasImagePath: '', // 图表临时图片路径
    showPosterImage: false, // 显示海报图片
    confirmButtonText: '保存本地' // 海报弹窗按钮文字
  },

  onLoad: function(options) {
    this.setData({
      year: options.year || '2025',
      openId: options.openId || null // 支持查看他人报告
    });
    // 确保用户信息已初始化
    App.initUserInfo(() => {
      this.loadYearlyReport();
    });
    
    // 只有查看自己的报告时才记录
    if (!options.openId) {
      try {
        wx.setStorageSync('yearlyReport2025Viewed', true);
      } catch (e) {
        console.error('保存查看记录失败:', e);
      }
    }
  },

  /**
   * 加载年度报告数据
   */
  loadYearlyReport: function() {
    wx.showLoading({
      title: '生成报告中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'getYearlyReport',
      data: {
        year: this.data.year,
        openId: this.data.openId || null // 如果传入了openId，查询他人的报告
      }
    }).then((res) => {
      wx.hideLoading();
      if (res.result.errCode) {
        wx.showToast({
          title: res.result.errMsg || '加载失败',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      const { stats, records } = res.result;
      
      // 如果云函数没有返回昵称，尝试从全局数据获取
      if (!stats.userInfo || !stats.userInfo.nickName || stats.userInfo.nickName === '用户') {
        const globalUserInfo = App.globalData.userInfo;
        if (globalUserInfo && globalUserInfo.nickName) {
          if (!stats.userInfo) {
            stats.userInfo = {};
          }
          stats.userInfo.nickName = globalUserInfo.nickName;
        }
      }
      
      // 将月度统计对象转换为数组
      const monthlyStatsArray = [];
      if (stats.monthlyStats) {
        Object.keys(stats.monthlyStats).forEach(month => {
          // 提取月份数字（从 "2025-10" 中提取 "10"）
          const monthNum = month.split('-')[1];
          monthlyStatsArray.push({
            month: month,
            monthText: monthNum, // 添加月份文本，用于显示
            ...stats.monthlyStats[month]
          });
        });
        // 按月份排序
        monthlyStatsArray.sort((a, b) => a.month.localeCompare(b.month));
      }
      
      // 计算体重变化绝对值
      const absWeightChange = stats.weightChange !== null ? Math.abs(stats.weightChange) : 0;
      
      // 处理高光月份文本
      let highlightMonthText = '';
      let highlightMonthLossText = '';
      if (stats.highlightMonth) {
        highlightMonthText = stats.highlightMonth.split('-')[1];
        // 格式化高光月份减重数值，保留两位小数
        if (stats.highlightMonthLoss !== null && stats.highlightMonthLoss !== undefined) {
          highlightMonthLossText = parseFloat(stats.highlightMonthLoss).toFixed(2);
        }
      }
      
      // 处理月度数据，添加格式化后的减重数据
      monthlyStatsArray.forEach(item => {
        if (item.weightLoss) {
          item.weightLossText = item.weightLoss.toFixed(1);
        }
      });
      
      this.setData({
        stats: stats,
        records: records,
        loading: false,
        encouragementText: this.getEncouragement(stats),
        monthlyStatsArray: monthlyStatsArray,
        absWeightChange: absWeightChange,
        highlightMonthText: highlightMonthText,
        highlightMonthLossText: highlightMonthLossText
      });

      // 准备图表数据
      this.prepareChartData(records);
      // 标记数据已准备好
      this.setData({
        dataReady: true
      });
      
      // 由于组件使用了 wx:if，需要等待组件渲染后再获取
      // 延迟初始化图表，确保DOM已渲染
      setTimeout(() => {
        // 重新获取组件（因为组件可能刚渲染出来）
        this.ecComponent = this.selectComponent('#yearly-chart');
        if (this.ecComponent) {
          this.setData({
            chartReady: true
          });
          this.tryInitChart();
        } else {
          // 如果还没找到，继续重试
          this.retryGetComponent();
        }
      }, 500);
    }).catch((err) => {
      wx.hideLoading();
      console.error('加载年度报告失败:', err);
      wx.showToast({
        title: '网络出小差了,请稍后再试...',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 准备图表数据
   */
  prepareChartData: function(records) {
    if (!records || records.length === 0) {
      console.log('没有记录数据');
      this.setData({
        'chartData.xData': [],
        'chartData.yData': []
      });
      return;
    }

    const weightRecords = records
      .filter(r => r && r.weight && r.weight > 0 && r.date)
      .sort((a, b) => {
        // 使用 dayjs 进行日期比较，更可靠
        return dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
      });

    if (weightRecords.length === 0) {
      console.log('没有有效的体重记录');
      this.setData({
        'chartData.xData': [],
        'chartData.yData': []
      });
      return;
    }

    const xData = weightRecords.map(r => {
      // 使用 dayjs 格式化日期
      const date = dayjs(r.date);
      return `${date.month() + 1}-${date.date()}`;
    });
    const yData = weightRecords.map(r => parseFloat(r.weight));

    console.log('图表数据准备完成:', { xDataLength: xData.length, yDataLength: yData.length });

    this.setData({
      'chartData.xData': xData,
      'chartData.yData': yData
    });
  },

  /**
   * 获取图表组件
   */
  onReady: function() {
    // 由于组件使用了 wx:if，在数据加载前组件不会渲染
    // 所以这里先不获取组件，等数据加载完成后再获取
    console.log('页面 onReady，等待数据加载完成');
  },
  
  /**
   * 重试获取组件
   */
  retryGetComponent: function(retryCount = 0) {
    if (retryCount > 10) {
      console.error('多次重试后仍未找到图表组件');
      return;
    }
    
    setTimeout(() => {
      this.ecComponent = this.selectComponent('#yearly-chart');
      if (this.ecComponent) {
        console.log('成功获取图表组件');
        this.setData({
          chartReady: true
        });
        this.tryInitChart();
      } else {
        console.log(`重试获取组件 (${retryCount + 1}/10)`);
        this.retryGetComponent(retryCount + 1);
      }
    }, 200);
  },

  /**
   * 尝试初始化图表（确保组件和数据都准备好）
   */
  tryInitChart: function() {
    // 如果组件还没准备好，等待
    if (!this.ecComponent) {
      console.log('组件未准备好，等待重试');
      setTimeout(() => {
        this.ecComponent = this.selectComponent('#yearly-chart');
        if (this.ecComponent) {
          this.tryInitChart();
        } else {
          // 如果还是找不到，重试获取组件
          this.retryGetComponent();
        }
      }, 200);
      return;
    }

    const { xData, yData } = this.data.chartData;
    // 如果没有数据，不初始化
    if (!xData || xData.length === 0) {
      console.log('图表数据为空，跳过初始化');
      return;
    }

    console.log('准备初始化图表，数据量:', xData.length);
    // 初始化图表
    this.initChart();
  },

  /**
   * 初始化图表
   */
  initChart: function() {
    // 从 data 中获取图表数据
    const { xData, yData } = this.data.chartData;
    
    if (!xData || xData.length === 0 || !yData || yData.length === 0) {
      console.log('图表数据为空，无法初始化', { xData, yData });
      return;
    }

    console.log('开始初始化图表', { xDataLength: xData.length, yDataLength: yData.length });

    if (!this.ecComponent) {
      console.error('图表组件未找到');
      return;
    }

    this.ecComponent.init((canvas, width, height, dpr) => {
      if (!canvas) {
        console.error('Canvas 初始化失败');
        return;
      }

      // 检查宽高是否有效
      if (width === 0 || height === 0) {
        console.error('Canvas 尺寸无效，等待重试', { width, height });
        setTimeout(() => {
          this.initChart();
        }, 300);
        return;
      }

      console.log('Canvas 初始化成功', { width, height, dpr });

      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr || 2
      });

      const option = {
        title: {
          text: `${this.data.year}年体重趋势`,
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 16,
            color: '#333'
          }
        },
        color: ['#37A2DA'],
        grid: {
          left: '15%',
          right: '10%',
          top: '20%',
          bottom: '15%'
        },
        tooltip: {
          trigger: 'axis',
          formatter: function(params) {
            const data = params[0];
            return `${data.name}\n体重: ${data.value}斤`;
          }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xData,
          axisLabel: {
            fontSize: 10,
            rotate: xData.length > 30 ? 45 : 0,
            interval: xData.length > 30 ? Math.ceil(xData.length / 15) : 0
          }
        },
        yAxis: {
          type: 'value',
          name: '体重(斤)',
          nameTextStyle: {
            color: '#37A2DA'
          },
          axisLabel: {
            formatter: '{value}'
          }
        },
        series: [{
          name: '体重',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            width: 2,
            color: '#37A2DA'
          },
          itemStyle: {
            color: '#37A2DA'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: 'rgba(55, 162, 218, 0.3)'
              }, {
                offset: 1,
                color: 'rgba(55, 162, 218, 0.1)'
              }]
            }
          },
          data: yData
        }]
      };

      chart.setOption(option);
      this.chart = chart;
      
      // 确保图表渲染
      setTimeout(() => {
        if (this.chart) {
          this.chart.resize();
        }
      }, 100);
      
      console.log('图表初始化完成');
      return chart;
    });
  },

  /**
   * 获取鼓励性话语
   */
  getEncouragement: function(stats) {
    if (!stats || stats.weightChange === null || stats.weightChange === undefined) {
      return '继续坚持，记录每一天的变化！';
    }

    if (stats.weightChange < -5) {
      return '太棒了！你减重了' + Math.abs(stats.weightChange) + '斤，继续保持！';
    } else if (stats.weightChange < 0) {
      return '很好！你减重了' + Math.abs(stats.weightChange) + '斤，继续加油！';
    } else if (stats.weightChange === 0) {
      return '体重保持稳定，很棒！';
    } else {
      return '体重有所增加，注意饮食和运动哦！';
    }
  },

  /**
   * 设置目标体重
   */
  setTargetWeight: function() {
    this.setData({
      showTargetDialog: true,
      targetWeight: ''
    });
  },
  
  /**
   * 关闭目标体重弹窗
   */
  closeTargetDialog: function(e) {
    if (e.detail === 'confirm') {
      // 保存目标体重
      const targetWeight = parseFloat(this.data.targetWeight);
      if (targetWeight && targetWeight > 0) {
        const targetWeightKg = targetWeight / 2; // 转换为千克
        
        // 调用云函数保存目标体重到 users 表
        CF.update("users", {
          openId: true
        }, {
          aimWeight: targetWeight,
          aimWeightKg: parseFloat(targetWeightKg.toFixed(2))
        }, (res) => {
          // 更新全局用户信息
          if (App.globalData.userInfo) {
            App.globalData.userInfo.aimWeight = targetWeight;
            App.globalData.userInfo.aimWeightKg = targetWeightKg;
          }
          
          wx.showToast({
            title: '目标已设置',
            icon: 'success',
            duration: 2000
          });
        }, (err) => {
          console.error('保存目标体重失败:', err);
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none',
            duration: 2000
          });
        });
      } else {
        wx.showToast({
          title: '请输入有效的目标体重',
          icon: 'none',
          duration: 2000
        });
        return; // 不关闭弹窗
      }
    }
    this.setData({
      showTargetDialog: false
    });
  },
  
  /**
   * 目标体重输入变化
   */
  onTargetWeightChange: function(e) {
    const targetWeight = parseFloat(e.detail);
    this.calculateTargetProgress(targetWeight);
    this.setData({
      targetWeight: e.detail
    });
  },
  
  /**
   * 计算目标进度
   */
  calculateTargetProgress: function(targetWeight) {
    const stats = this.data.stats;
    
    if (targetWeight && stats && stats.endWeight) {
      const weightLoss = Math.max(0, stats.endWeight - targetWeight);
      // 计算进度（假设从当前体重到50斤为100%）
      const maxLoss = Math.max(1, stats.endWeight - 50);
      const progress = Math.min(100, (weightLoss / maxLoss) * 100);
      
      this.setData({
        targetWeightLoss: weightLoss.toFixed(1),
        targetProgress: progress
      });
    } else {
      this.setData({
        targetWeightLoss: 0,
        targetProgress: 0
      });
    }
  },
  
  /**
   * 判断是否可以生成海报
   */
  canGetPoster: function() {
    const { xData, yData } = this.data.chartData;
    if (!xData || xData.length === 0) {
      wx.showToast({
        icon: 'none',
        title: '至少要有一条数据才可以分享~',
        duration: 2000
      });
      return false;
    }
    return true;
  },
  
  /**
   * 生成分享海报（跳转到海报页面）
   */
  generateSharePoster: function() {
    const stats = this.data.stats;
    if (!stats) {
      wx.showToast({
        title: '数据加载中...',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到海报页面
    wx.navigateTo({
      url: `/pages/yearlyReport/posterPage?year=${this.data.year}`
    });
  },
  
  /**
   * 生成海报内容
   */
  showPoster: function() {
    const stats = this.data.stats;
    const nickName = stats.userInfo && stats.userInfo.nickName ? stats.userInfo.nickName : '未授权';
    
    // 深拷贝海报数据，避免修改原始模板
    const poster = JSON.parse(JSON.stringify(posterData));
    
    // 设置用户昵称
    poster.views[1].content = '您的好友【' + nickName + '】';
    
    // 设置年度减重信息
    let weightChangeText = '';
    if (stats.weightChange !== null && stats.weightChange < 0) {
      const weightChangeKg = Math.abs(stats.weightChange / 2).toFixed(2);
      weightChangeText = '在【' + this.data.year + '年】期间体重减少' + weightChangeKg + 'KG！';
    } else if (stats.totalDays > 0) {
      weightChangeText = '在【' + this.data.year + '年】坚持打卡' + stats.totalDays + '天！';
    } else {
      weightChangeText = '在【' + this.data.year + '年】开始记录体重变化！';
    }
    poster.views[2].content = weightChangeText;
    
    // 设置图表图片
    poster.views[3].url = this.data.canvasImagePath;
    
    this.setData({
      painting: poster
    });
  },
  
  /**
   * 海报生成完成回调
   */
  eventGetImage: function(event) {
    console.log('海报生成完成:', event);
    wx.hideLoading();
    const { tempFilePath, errMsg } = event.detail;
    
    if (errMsg === 'canvasdrawer:ok' || errMsg === 'canvasdrawer:samme params') {
      this.setData({
        fileid: tempFilePath || this.data.canvasImagePath,
        showPosterImage: true,
        showImageButton: true
      });
    } else {
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    }
  },
  
  /**
   * 隐藏海报图片
   */
  hidePosterImage: function() {
    this.setData({
      showPosterImage: false
    });
  },
  
  /**
   * 下载海报图片
   */
  downLoadPosterImage: function(e) {
    this.setData({
      showPosterImage: false
    });
    
    if (e.detail !== 'confirm') {
      return;
    }
    
    if (this.data.fileid.indexOf('cloud') === 0) {
      wx.cloud.downloadFile({
        fileID: this.data.fileid,
        success: res => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success() {
              wx.showToast({
                title: '保存图片成功',
                icon: 'success',
                duration: 2000
              });
            },
            fail() {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
          });
        },
        fail: console.error
      });
    } else {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.fileid,
        success() {
          wx.showToast({
            title: '保存图片成功',
            icon: 'success',
            duration: 2000
          });
        },
        fail() {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      });
    }
  },
  
  /**
   * 跳转到首页（查看他人报告时点击提示）
   */
  goToIndex: function() {
    wx.switchTab({
      url: '/pages/indexV2/index'
    });
  },
  
  /**
   * 分享到朋友圈（按钮点击）
   */
  shareToTimeline: function() {
    // 微信小程序分享到朋友圈需要通过右上角菜单触发
    // 引导用户使用右上角菜单分享
    wx.showModal({
      title: '分享到朋友圈',
      content: '请点击右上角"..."菜单，选择"分享到朋友圈"',
      showCancel: false,
      confirmText: '知道了'
    });
  },
  
  /**
   * 显示分享给好友提示
   */
  showShareTip: function() {
    wx.showToast({
      title: '✨点击右上角"..."分享给好友吧～',
      icon: 'none',
      duration: 2500
    });
  },
  
  /**
   * 分享到朋友圈（页面配置）
   */
  onShareTimeline: function() {
    const stats = this.data.stats;
    let title = `我的${this.data.year}年瘦身打卡报告`;
    
    if (stats && stats.weightChange !== null && stats.weightChange < 0) {
      title = `我今年瘦了${Math.abs(stats.weightChange)}斤～`;
    }
    
    return {
      title: title,
      imageUrl: '' // 可以后续添加海报图片路径
    };
  },
  
  /**
   * 分享报告
   */
  onShareAppMessage: function() {
    const stats = this.data.stats;
    let title = `我的${this.data.year}年瘦身打卡报告`;
    
    if (stats && stats.weightChange !== null && stats.weightChange < 0) {
      title = `✨我今年瘦了${Math.abs(stats.weightChange)}斤！快来一起打卡吧💪`;
    } else {
      title = `✨我的${this.data.year}年瘦身打卡报告出炉啦～快来一起打卡吧💪`;
    }
    
    // 如果当前用户有openId，分享时带上openId参数，让好友可以查看
    const openId = App.globalData.userInfo && App.globalData.userInfo.openId ? App.globalData.userInfo.openId : '';
    let path = `/pages/yearlyReport/yearlyReport?year=${this.data.year}`;
    if (openId) {
      path += `&openId=${openId}`;
    }
    
    return {
      title: title,
      path: path,
      imageUrl: '' // 可以后续添加海报图片路径
    };
  }
});

