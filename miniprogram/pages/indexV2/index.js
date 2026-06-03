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

function formatWeight(value) {
  const num = toNumber(value);
  if (num === null) return '';
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
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
    totalCheckinDays: '--',
    monthCheckinDays: 0,
    targetText: '',
    targetProgress: 0,
    hasSelectedRecord: false,
    hasChartData: false,
    showOnboarding: false,
    showCheckinDialog: false,
    showBmiDialog: false,
    showSharePanel: false,
    showShareNudge: false,
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
      monthCheckinDays: records.length,
      targetText: targetInfo.text,
      targetProgress: targetInfo.progress,
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

  getTargetInfo(records, latest, aimWeight) {
    const current = latest ? toNumber(latest.weight) : null;
    if (!current || !aimWeight) {
      return { text: '', progress: 0 };
    }
    const distance = current - aimWeight;
    const text = distance > 0 ? `距目标 ${distance.toFixed(1)}斤` : '已达目标';
    let progress = 100;
    if (records.length > 1) {
      const first = toNumber(records[0].weight);
      const total = first - aimWeight;
      const done = first - current;
      progress = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 100;
    } else if (distance > 0) {
      progress = 0;
    }
    return { text, progress };
  },

  initTrendChart() {
    const records = this.data.records.filter((item) => item.weight);
    if (records.length < 2) return;

    const xData = records.map((item) => dayjs(item.date).format('DD'));
    const weightData = records.map((item) => toNumber(item.weight));
    const aimWeight = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
    const axisValues = aimWeight ? weightData.concat([aimWeight]) : weightData;
    const series = [
      { name: '体重', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 3 }, areaStyle: { opacity: 0.12 }, data: weightData }
    ];
    if (aimWeight) {
      series.push({
        name: '目标体重',
        type: 'line',
        symbol: 'none',
        label: {
          show: true,
          position: 'right',
          formatter: '目标',
          color: '#1fb9a5',
          fontSize: 10
        },
        lineStyle: { width: 2, type: 'dashed', color: '#1fb9a5' },
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
          color: ['#188be4'],
          grid: { left: 36, right: 42, top: 36, bottom: 28 },
          legend: aimWeight ? { data: ['体重', '目标体重'], top: 4, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11 } } : undefined,
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: xData, boundaryGap: false, axisLabel: { fontSize: 10, hideOverlap: true } },
          yAxis: { type: 'value', scale: true, min: getAxisMin(axisValues), max: getAxisMax(axisValues), axisLabel: { fontSize: 10 } },
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
      url: `/pages/recordsV2/records?month=${this.data.currentMonth}`
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
    this.setData({ showBmiDialog: false });
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

  noop() {},

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
        this.setData({ showOnboarding: false });
        this.refreshAll();
        wx.showToast({ title: '已开始记录', icon: 'success' });
        this.showAddToDesktopGuide();
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
    const isNewCheckin = !this.data.hasSelectedRecord;
    const isTodayCheckin = this.data.selectedDate === formatDate(new Date());
    const request = isNewCheckin
      ? CF.insert('records', data)
      : CF.update('records', { openId: true, date: this.data.selectedDate }, data);

    request.then(() => {
      this.setData({
        showCheckinDialog: false,
        showShareNudge: isNewCheckin && isTodayCheckin
      });
      this.loadMonthRecords();
      wx.showToast({ title: '已保存', icon: 'success' });
    });
  },

  onShareAppMessage() {
    return {
      title: this.getShareTitle(),
      path: '/pages/indexV2/index'
    };
  },

  onShareTimeline() {
    return {
      title: this.getShareTitle()
    };
  }
});
