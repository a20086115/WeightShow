import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import { cloud as CF } from '../../utils/cloudFunctionPromise.js';

const App = getApp();
const CHECKIN_SUBSCRIBE_TEMPLATE_ID = '-ejtsE73bMY5DzlafJoQvPxhkOUklQUP_hZGIMLWzXA';

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${pad(date.getDate())}`;
}

function toNumber(value) {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * 体重数值格式化：统一保留最多两位小数，并去除多余的尾随零。
 * 例如 182 -> "182"，182.10 -> "182.1"，182.125 -> "182.13"。
 * @param {string|number} value 待格式化的数值
 * @returns {string} 格式化后的字符串
 */
function formatWeight(value) {
  const num = toNumber(value);
  if (num === null) return '';
  if (Number.isInteger(num)) return String(num);
  return parseFloat(num.toFixed(2)).toString();
}

function getAxisMin(values, minPadding = 4) {
  const nums = values.filter((item) => item !== null && Number.isFinite(item));
  if (!nums.length) return undefined;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const padding = Math.max(minPadding, range * 0.12);
  return Math.floor(min - padding);
}

function getAxisMax(values, minPadding = 4) {
  const nums = values.filter((item) => item !== null && Number.isFinite(item));
  if (!nums.length) return undefined;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const padding = Math.max(minPadding, range * 0.12);
  return Math.ceil(max + padding);
}

function getFieldValue(e) {
  return e && e.detail && e.detail.value !== undefined ? e.detail.value : e.detail;
}

Page({
  data: {
    currentMonth: formatMonth(new Date()),
    selectedDate: formatDate(new Date()),
    selectedDateText: '今日',
    records: [],
    recordsMap: {},
    displayWeight: '',
    bmiValue: '',
    bmiLabel: '',
    bmiClass: '',
    todayChangeText: '',
    todayChangeClass: '',
    monthChangeText: '--',
    monthChangeClass: '',
    monthTrendLabel: '已减',
    monthLossValue: '--',
    totalCheckinDays: '--',
    monthCheckinDays: 0,
    targetText: '',
    targetDistanceValue: '--',
    aimWeightText: '--',
    targetProgress: 0,
    targetProgressDisplay: 0,
    hasSelectedRecord: false,
    hasChartData: false,
    showOnboarding: false,
    showCheckinDialog: false,
    showCheckinSuccessDialog: false,
    showBmiDialog: false,
    showSharePanel: false,
    showShareNudge: false,
    visibleJoinGroup: false,
    pendingAddToDesktopGuide: false,
    htmlImage: 'cloud://release-ba24f3.7265-release-ba24f3-1257780911/activity.png',
    bmiMarkerPosition: 0,
    sharePreviewText: '记录每天变化，一起打卡吧',
    subscribeChecked: true,
    reminderTime: dayjs().format('HH:mm'),
    visibleReminderTimePicker: false,
    newUserHeight: '',
    newUserWeight: '',
    newUserTarget: '',
    checkinWeight: '',
    checkinWeightKg: '',
    checkinSuccess: {
      weightText: '',
      bmiText: '',
      bmiClass: '',
      monthDaysText: '',
      monthDaysValue: '',
      monthChangeText: '',
      monthChangeValue: '',
      targetText: '',
      targetValue: '',
      shareTitle: ''
    },
    ec: {
      lazyLoad: true
    }
  },

  onLoad() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    App.initUserInfo(() => {
      this.refreshAll();
    });
  },

  onReady() {
    this.ecComponent = this.selectComponent('#trend-chart');
  },

  refreshAll() {
    this.loadMonthRecords();
    this.loadLastRecordForOnboarding();
    this.loadTotalCheckinDays();
  },

  loadTotalCheckinDays() {
    CF.count('records', { openId: true }).then((res) => {
      const total = res.result && typeof res.result.total === 'number' ? res.result.total : 0;
      this.setData({ totalCheckinDays: total });
    }).catch(() => {});
  },

  loadLastRecordForOnboarding() {
    wx.cloud.callFunction({
      name: 'getLastWeightRecord'
    }).then((res) => {
      const list = (res.result && res.result.data) || [];
      const hasLastWeight = list.length > 0 && list[0].weight;
      const hasHeight = !!(App.globalData.userInfo && App.globalData.userInfo.height);
      if (!hasLastWeight && !hasHeight) {
        this.setData({ showOnboarding: true });
      }
    }).catch(() => {});
  },

  loadMonthRecords() {
    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: this.data.currentMonth
      }
    }).then((res) => {
      const records = ((res.result && res.result.data) || [])
        .filter((item) => item && item.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      this.applyRecords(records);
    }).catch(() => {
      wx.showToast({ title: '加载失败，请稍后再试', icon: 'none' });
    });
  },

  applyRecords(records) {
    const recordsMap = {};
    records.forEach((record) => {
      if (record.weight) {
        recordsMap[record.date] = {
          ...record,
          weight: formatWeight(record.weight)
        };
      }
    });

    this.setData({
      records,
      recordsMap,
      hasChartData: records.filter((item) => item.weight).length >= 2
    }, () => {
      this.updateOverview();
      this.initTrendChart();
    });
  },

  updateOverview(callback) {
    const records = this.data.records.filter((item) => item.weight);
    const selected = this.data.recordsMap[this.data.selectedDate];
    const latest = selected || records[records.length - 1] || null;
    const height = toNumber(App.globalData.userInfo && App.globalData.userInfo.height);
    const aimWeight = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
    const displayWeight = latest ? formatWeight(latest.weight) : '';
    const bmiInfo = this.getBmiInfo(displayWeight, height);
    const previous = this.getPreviousRecord(latest);
    const changeInfo = this.getChangeInfo(latest, previous, '较上次');
    const monthChangeInfo = this.getMonthChangeInfo(records);
    const targetInfo = this.getTargetInfo(records, latest, aimWeight);
    const selectedDateText = this.data.selectedDate === formatDate(new Date())
      ? '今日'
      : dayjs(this.data.selectedDate).format('MM月DD日');

    this.setData({
      selectedDateText,
      displayWeight,
      bmiValue: bmiInfo.value,
      bmiLabel: bmiInfo.label,
      bmiClass: bmiInfo.className,
      todayChangeText: changeInfo.text,
      todayChangeClass: changeInfo.className,
      monthChangeText: monthChangeInfo.text,
      monthChangeClass: monthChangeInfo.className,
      monthTrendLabel: monthChangeInfo.className === 'month-up' ? '变化' : '已减',
      monthLossValue: this.getMonthLossValue(records),
      monthCheckinDays: records.length,
      targetText: targetInfo.text,
      targetDistanceValue: this.getTargetDistanceValue(latest, aimWeight),
      aimWeightText: aimWeight ? formatWeight(aimWeight) : '--',
      targetProgress: targetInfo.progress,
      targetProgressDisplay: targetInfo.progressDisplay,
      sharePreviewText: this.getShareTitle(records),
      hasSelectedRecord: !!selected,
      checkinWeight: selected ? selected.weight : '',
      checkinWeightKg: selected && selected.weight ? formatWeight(toNumber(selected.weight) / 2) : ''
    }, callback);
  },

  getBmiInfo(weight, height) {
    const weightNum = toNumber(weight);
    if (!weightNum || !height) {
      return { value: '', label: '', className: '' };
    }
    const bmi = weightNum / 2 / (height * height / 10000);
    const value = bmi.toFixed(2);
    if (bmi <= 18.4) return { value, label: '偏瘦', className: '' };
    if (bmi < 24) return { value, label: '正常', className: 'normal' };
    if (bmi < 28) return { value, label: '超重', className: '' };
    return { value, label: '肥胖', className: '' };
  },

  getBmiPositionPercent(bmi) {
    const value = toNumber(bmi);
    if (!value || value <= 0) return 0;
    let position = 0;
    if (value <= 18.4) {
      position = (value / 18.4) * 25;
    } else if (value < 24) {
      position = 25 + ((value - 18.5) / (23.9 - 18.5)) * 25;
    } else if (value < 28) {
      position = 50 + ((value - 24) / (27.9 - 24)) * 25;
    } else {
      position = 75 + Math.min((value - 28) / (40 - 28), 1) * 25;
    }
    return Math.max(0, Math.min(100, position));
  },

  getPreviousRecord(record) {
    if (!record) return null;
    const list = this.data.records.filter((item) => item.weight && item.date < record.date);
    return list[list.length - 1] || null;
  },

  getChangeInfo(record, previous, prefix) {
    if (!record || !previous) return { text: '', className: '' };
    const diff = toNumber(record.weight) - toNumber(previous.weight);
    if (!Number.isFinite(diff) || diff === 0) {
      return { text: `${prefix} 持平`, className: '' };
    }
    const sign = diff > 0 ? '+' : '';
    return {
      text: `${prefix} ${sign}${diff.toFixed(1)}`,
      className: diff > 0 ? 'change-up' : 'change-down'
    };
  },

  getMonthChangeInfo(records) {
    if (records.length < 2) return { text: '--', className: '' };
    const first = toNumber(records[0].weight);
    const last = toNumber(records[records.length - 1].weight);
    const diff = last - first;
    const sign = diff > 0 ? '+' : '';
    return {
      text: `${sign}${diff.toFixed(1)}斤`,
      className: diff > 0 ? 'month-up' : diff < 0 ? 'month-down' : ''
    };
  },

  getMonthLossValue(records) {
    if (records.length < 2) return '--';
    const first = toNumber(records[0].weight);
    const last = toNumber(records[records.length - 1].weight);
    const diff = last - first;
    if (!Number.isFinite(diff)) return '--';
    if (diff < 0) return Math.abs(diff).toFixed(1);
    if (diff > 0) return `+${diff.toFixed(1)}`;
    return '0.0';
  },

  getTargetDistanceValue(latest, aimWeight) {
    const current = latest ? toNumber(latest.weight) : null;
    if (!current || !aimWeight) return '--';
    return current > aimWeight ? (current - aimWeight).toFixed(1) : '0.0';
  },

  getSuccessMonthChangeText(records) {
    if (records.length < 2) return '本月变化 --';
    const first = toNumber(records[0].weight);
    const last = toNumber(records[records.length - 1].weight);
    const diff = last - first;
    if (!Number.isFinite(diff) || diff === 0) return '本月持平';
    if (diff < 0) return `本月已减 ${Math.abs(diff).toFixed(1)}斤`;
    return `本月增加 ${diff.toFixed(1)}斤`;
  },

  buildCheckinSuccess(record) {
    const nextRecord = {
      ...record,
      weight: formatWeight(record.weight)
    };
    const records = this.data.records
      .filter((item) => item.date !== record.date)
      .concat([nextRecord])
      .filter((item) => item.weight)
      .sort((a, b) => a.date.localeCompare(b.date));
    const height = toNumber(App.globalData.userInfo && App.globalData.userInfo.height);
    const aimWeight = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
    const bmiInfo = this.getBmiInfo(nextRecord.weight, height);
    const targetInfo = this.getTargetInfo(records, nextRecord, aimWeight);
    const monthChangeText = this.getSuccessMonthChangeText(records);
    const targetText = targetInfo.text || '目标待设置';

    return {
      weightText: nextRecord.weight,
      bmiText: bmiInfo.value ? `BMI ${bmiInfo.value}｜${bmiInfo.label}` : 'BMI 待完善',
      bmiClass: bmiInfo.className,
      monthDaysText: `本月已打卡 ${records.length} 天`,
      monthDaysValue: `${records.length} 天`,
      monthChangeText,
      monthChangeValue: records.length < 2 ? '--' : monthChangeText.indexOf('本月') === 0 ? monthChangeText.slice(2).trim() : monthChangeText,
      targetText,
      targetValue: targetText.indexOf('距目标') === 0 ? targetText.slice(3).trim() : targetText,
      shareTitle: this.getCheckinShareTitle(records, nextRecord)
    };
  },

  getShareTitle(records) {
    const sourceRecords = records || this.data.records.filter((item) => item.weight);
    if (sourceRecords.length >= 2) {
      const first = toNumber(sourceRecords[0].weight);
      const last = toNumber(sourceRecords[sourceRecords.length - 1].weight);
      const loss = first - last;
      if (Number.isFinite(loss) && loss > 0) {
        return `本月已瘦${loss.toFixed(1)}斤，一起打卡！`;
      }
    }
    if (sourceRecords.length > 0) {
      return '记录每天变化，一起打卡吧';
    }
    return '瘦身打卡助手';
  },

  /**
   * 生成「打卡成功」直接转发好友的文案：突出今日体重与较上一次打卡的当日变化
   * @param {Array} records 已按日期升序、且包含今日的体重记录
   * @param {Object} todayRecord 今日记录（weight 已格式化为斤）
   * @returns {string} 分享标题
   */
  getCheckinShareTitle(records, todayRecord) {
    const todayWeight = toNumber(todayRecord.weight);
    if (!Number.isFinite(todayWeight)) {
      return this.getShareTitle(records);
    }
    const weightText = formatWeight(todayWeight);
    // 取今日之前最近的一条打卡作为对比基准
    const previous = (records || [])
      .filter((item) => item.weight && item.date < todayRecord.date)
      .pop();
    if (!previous) {
      return `今日体重${weightText}斤，开启我的瘦身打卡！`;
    }
    const delta = toNumber(previous.weight) - todayWeight; // 正数=较上次瘦了
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) {
      return `今日体重${weightText}斤，和上次持平，稳住！`;
    }
    if (delta > 0) {
      return `今日体重${weightText}斤，今天瘦了${delta.toFixed(1)}斤！`;
    }
    return `今日体重${weightText}斤，今天胖了${Math.abs(delta).toFixed(1)}斤，明天扳回来！`;
  },

  getTargetInfo(records, latest, aimWeight) {
    const current = latest ? toNumber(latest.weight) : null;
    if (!current || !aimWeight) {
      return { text: '', progress: 0, progressDisplay: 0 };
    }
    const distance = current - aimWeight;
    const text = distance > 0 ? `距目标 ${distance.toFixed(1)}斤` : '已达目标';
    let rawProgress = 100;
    if (records.length > 1) {
      const first = toNumber(records[0].weight);
      const total = first - aimWeight;
      const done = first - current;
      rawProgress = total > 0 ? Math.round((done / total) * 100) : 100;
    } else if (distance > 0) {
      rawProgress = 0;
    }
    // 进度条宽度不能为负，限制在 0~100
    const progress = Math.max(0, Math.min(100, rawProgress));
    // 文案展示真实进度：增重/偏离目标时可为负数，上下限 -100 ~ 100
    const progressDisplay = Math.max(-100, Math.min(100, rawProgress));
    return { text, progress, progressDisplay };
  },

  initTrendChart() {
    const records = this.data.records.filter((item) => item.weight);
    if (records.length < 2) return;

    const xData = records.map((item) => dayjs(item.date).format('DD'));
    const weightData = records.map((item) => toNumber(item.weight));
    const aimWeight = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
    const axisValues = aimWeight ? weightData.concat([aimWeight]) : weightData;
    const series = [
      {
        name: '体重(斤)',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        label: { show: false },
        lineStyle: { width: 3, color: '#167cff' },
        itemStyle: {
          color: '#ffffff',
          borderColor: '#167cff',
          borderWidth: 2
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(22, 124, 255, 0.18)' },
            { offset: 1, color: 'rgba(22, 124, 255, 0)' }
          ])
        },
        data: weightData
      }
    ];
    if (aimWeight) {
      series.push({
        name: '目标(斤)',
        type: 'line',
        symbol: 'none',
        label: { show: false },
        lineStyle: { width: 2, type: 'dashed', color: '#21c875' },
        data: weightData.map(() => aimWeight)
      });
    }

    wx.nextTick(() => {
      this.ecComponent = this.selectComponent('#trend-chart');
      if (!this.ecComponent) return;

      this.ecComponent.init((canvas, width, heightPx, dpr) => {
        if (!canvas || !width || !heightPx) return null;
        const chart = echarts.init(canvas, null, {
          width,
          height: heightPx,
          devicePixelRatio: dpr || 1
        });
        chart.setOption({
          color: ['#167cff', '#21c875'],
          grid: { left: 8, right: 12, top: 16, bottom: 24, containLabel: true },
          tooltip: { trigger: 'axis' },
          xAxis: {
            type: 'category',
            data: xData.map((item) => `${this.data.currentMonth.slice(5)}/${item}`),
            boundaryGap: false,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: '#e5ebf2' } },
            axisLabel: { color: '#627494', fontSize: 10, hideOverlap: true }
          },
          yAxis: {
            type: 'value',
            scale: true,
            min: getAxisMin(axisValues),
            max: getAxisMax(axisValues),
            splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } },
            axisLabel: { color: '#627494', fontSize: 10 }
          },
          series
        });
        this.chart = chart;
        return chart;
      });
    });
  },

  shiftMonth(offset) {
    const current = dayjs(`${this.data.currentMonth}-01`).toDate();
    current.setMonth(current.getMonth() + offset);
    const currentMonth = formatMonth(current);
    const selectedDate = `${currentMonth}-01`;
    this.setData({ currentMonth, selectedDate }, () => this.loadMonthRecords());
  },

  prevMonth() {
    this.shiftMonth(-1);
  },

  nextMonth() {
    this.shiftMonth(1);
  },

  onCalendarSelect(e) {
    const selectedDate = e.detail.date;
    const selected = this.data.recordsMap[selectedDate];
    this.setData({
      selectedDate,
      hasSelectedRecord: !!selected,
      checkinWeight: selected ? selected.weight : '',
      checkinWeightKg: selected && selected.weight ? formatWeight(toNumber(selected.weight) / 2) : ''
    }, () => {
      this.openCheckin();
    });
  },

  goRecords() {
    wx.navigateTo({
      url: `/pages/recordsV2/records?month=${this.data.currentMonth}`
    });
  },

  goAnalysis() {
    wx.navigateTo({
      url: `/pages/analysis/analysis?month=${this.data.currentMonth}`
    });
  },

  goUserInfoTarget() {
    wx.navigateTo({
      url: '/pages/userinfo/userinfo'
    });
  },

  openCheckin() {
    const weight = toNumber(this.data.checkinWeight);
    this.setData({
      showCheckinDialog: true,
      checkinWeightKg: weight ? formatWeight(weight / 2) : this.data.checkinWeightKg
    });
  },

  closeCheckin() {
    this.setData({
      showCheckinDialog: false,
      visibleReminderTimePicker: false
    }, () => {
      this.initTrendChart();
    });
  },

  onNewHeightInput(e) {
    this.setData({ newUserHeight: e.detail.value });
  },

  onNewWeightInput(e) {
    this.setData({ newUserWeight: e.detail.value });
  },

  onNewTargetInput(e) {
    this.setData({ newUserTarget: e.detail.value });
  },

  onCheckinWeightInput(e) {
    this.onCheckinWeightChange(e);
  },

  onCheckinWeightChange(e) {
    const value = getFieldValue(e);
    const weight = toNumber(value);
    this.setData({
      checkinWeight: value || '',
      checkinWeightKg: weight ? formatWeight(weight / 2) : ''
    });
  },

  onCheckinWeightKgChange(e) {
    const value = getFieldValue(e);
    const weightKg = toNumber(value);
    this.setData({
      checkinWeightKg: value || '',
      checkinWeight: weightKg ? formatWeight(weightKg * 2) : ''
    });
  },

  onSubscribeCheckboxChange(event) {
    this.setData({
      subscribeChecked: event.detail
    });
  },

  showReminderTimePicker() {
    this.setData({
      visibleReminderTimePicker: true
    });
  },

  onReminderTimeConfirm(event) {
    const time = event.detail;
    const timeParts = time.split(':');
    const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
    this.setData({
      reminderTime: formattedTime,
      visibleReminderTimePicker: false
    });
  },

  onReminderTimeCancel() {
    this.setData({
      visibleReminderTimePicker: false
    });
  },

  showBmiInfo() {
    this.setData({
      showBmiDialog: true,
      bmiMarkerPosition: this.getBmiPositionPercent(this.data.bmiValue)
    });
  },

  closeBmiInfo() {
    this.setData({ showBmiDialog: false }, () => {
      this.initTrendChart();
    });
  },

  openSharePanel() {
    this.setData({
      showSharePanel: true,
      showShareNudge: false,
      sharePreviewText: this.getShareTitle()
    });
  },

  closeSharePanel() {
    this.setData({ showSharePanel: false }, () => {
      this.initTrendChart();
    });
  },

  dismissShareNudge() {
    this.setData({ showShareNudge: false });
  },

  closeCheckinSuccess() {
    const shouldShowDesktopGuide = this.data.pendingAddToDesktopGuide;
    this.setData({
      showCheckinSuccessDialog: false,
      pendingAddToDesktopGuide: false
    }, () => {
      this.initTrendChart();
      if (shouldShowDesktopGuide) {
        this.showAddToDesktopGuide();
      }
    });
  },

  goSuccessAnalysis() {
    this.setData({ showCheckinSuccessDialog: false }, () => {
      this.goAnalysis();
    });
  },

  noop() {},

  openJoinGroupDialog() {
    CF.get('notice', {}).then((res) => {
      const list = res.result && res.result.data ? res.result.data : [];
      const latestNotice = list[0];
      this.setData({
        htmlImage: latestNotice && latestNotice.image ? latestNotice.image : this.data.htmlImage,
        visibleJoinGroup: true
      });
    }).catch(() => {
      this.setData({ visibleJoinGroup: true });
    });
  },

  closeJoinGroup(e) {
    this.setData({ visibleJoinGroup: false }, () => {
      this.initTrendChart();
    });
    if (!e || e.detail !== 'confirm') return;
    wx.cloud.downloadFile({
      fileID: this.data.htmlImage,
      success: () => {
        wx.showToast({
          title: '保存二维码成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: console.error
    });
  },

  guideShareTimeline() {
    this.setData({ showSharePanel: false }, () => {
      this.initTrendChart();
      wx.showModal({
        title: '分享到朋友圈',
        content: '请点击右上角"..."菜单，选择"分享到朋友圈"',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#188be4'
      });
    });
  },

  requestCheckinSubscribe() {
    if (!this.data.subscribeChecked || !wx.requestSubscribeMessage) return;
    wx.requestSubscribeMessage({
      tmplIds: [CHECKIN_SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        if (res.errMsg !== 'requestSubscribeMessage:ok') return;
        const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const timeParts = this.data.reminderTime.split(':');
        const formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        wx.cloud.callFunction({
          name: 'updateOrInsert',
          data: {
            tbName: 'subscribe',
            query: {
              openId: true,
              day: tomorrow
            },
            data: {
              day: tomorrow,
              subscribeDate: `${tomorrow} ${formattedTime}`
            }
          }
        }).catch((err) => {
          console.error('订阅消息记录失败:', err);
        });
      },
      fail: (err) => {
        console.error('订阅消息失败:', err);
      }
    });
  },

  showAddToDesktopGuide() {
    const storageKey = 'indexV2DesktopGuideShown';
    if (wx.getStorageSync(storageKey)) return;
    wx.setStorageSync(storageKey, true);
    setTimeout(() => {
      wx.showModal({
        title: '添加到桌面',
        content: '以后每天打卡会更方便。点击右上角「...」，选择「添加到我的小程序」或「添加到桌面」。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#188be4'
      });
    }, 700);
  },

  submitOnboarding() {
    const height = toNumber(this.data.newUserHeight);
    const weight = toNumber(this.data.newUserWeight);
    const target = toNumber(this.data.newUserTarget);
    if (!height || height <= 0 || !weight || weight <= 0 || !target || target <= 0) {
      wx.showToast({ title: '请填写身高、体重和目标', icon: 'none' });
      return;
    }

    const updateData = {
      height,
      aimWeight: target,
      aimWeightKg: Number((target / 2).toFixed(2))
    };

    this.requestCheckinSubscribe();

    CF.update('users', { openId: true }, updateData)
      .then(() => CF.insert('records', {
        date: formatDate(new Date()),
        weight,
        weightKg: Number((weight / 2).toFixed(2))
      }))
      .then(() => {
        App.globalData.userInfo.height = height;
        App.globalData.userInfo.aimWeight = target;
        this.setData({
          showOnboarding: false,
          pendingAddToDesktopGuide: true,
          showCheckinSuccessDialog: true,
          checkinSuccess: this.buildCheckinSuccess({
            date: formatDate(new Date()),
            weight,
            weightKg: Number((weight / 2).toFixed(2))
          })
        });
        this.refreshAll();
      });
  },

  submitCheckin() {
    const weight = toNumber(this.data.checkinWeight);
    if (!weight || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    const data = {
      date: this.data.selectedDate,
      weight,
      weightKg: Number((weight / 2).toFixed(2))
    };
    this.requestCheckinSubscribe();
    const isTodayCheckin = this.data.selectedDate === formatDate(new Date());
    const request = !this.data.hasSelectedRecord
      ? CF.insert('records', data)
      : CF.update('records', { openId: true, date: this.data.selectedDate }, data);

    request.then(() => {
      this.setData({
        showCheckinDialog: false,
        showShareNudge: false,
        showCheckinSuccessDialog: isTodayCheckin,
        checkinSuccess: isTodayCheckin ? this.buildCheckinSuccess(data) : this.data.checkinSuccess
      });
      this.loadMonthRecords();
      if (!isTodayCheckin) {
        wx.showToast({ title: '已保存', icon: 'success' });
      }
    });
  },

  onShareAppMessage(e) {
    // 来自打卡成功弹框的「分享给好友」按钮：使用突出今日体重与当日变化的文案
    const dataset = e && e.from === 'button' && e.target ? e.target.dataset : null;
    if (dataset && dataset.shareType === 'checkin') {
      return {
        title: this.data.checkinSuccess.shareTitle || this.getShareTitle(),
        path: '/pages/indexV2/index'
      };
    }
    return {
      title: this.data.showSharePanel ? this.data.sharePreviewText : this.getShareTitle(),
      path: '/pages/indexV2/index'
    };
  },

  onShareTimeline() {
    return {
      title: this.getShareTitle()
    };
  }
});
