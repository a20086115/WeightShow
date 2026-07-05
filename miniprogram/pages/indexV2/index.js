import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import { cloud as CF } from '../../utils/cloudFunctionPromise.js';
import {
  getCheckinReminderPreference,
  buildCheckinReminderUpdate,
  normalizeCheckinReminderTime
} from '../../utils/checkinReminder.js';

const App = getApp();
const CHECKIN_SUBSCRIBE_TEMPLATE_ID = '-ejtsE73bMY5DzlafJoQvPxhkOUklQUP_hZGIMLWzXA';
const HIDE_ANALYSIS_REPORT_CODE = 'hide_analysis_report';
const DEFAULT_CHECKIN_TAG_OPTIONS = [
  '健康饮食',
  '正常干饭',
  '饮食超标',
  '运动打卡'
];
const MAX_CHECKIN_TAG_OPTIONS = 16;
const MAX_CHECKIN_TAG_LENGTH = 8;
const MAX_CHECKIN_IMAGES = 1;

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDate(date) {
  return `${formatMonth(date)}-${pad(date.getDate())}`;
}

function getExpandedMonthRange(yearMonth) {
  const firstDay = dayjs(`${yearMonth}-01`).toDate();
  const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
  const start = new Date(firstDay);
  const end = new Date(lastDay);
  start.setDate(start.getDate() - 7);
  end.setDate(end.getDate() + 7);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

function getDefaultSelectedDate(yearMonth) {
  const today = formatDate(new Date());
  return today.indexOf(yearMonth) === 0 ? today : `${yearMonth}-01`;
}

/**
 * 判断日期是否晚于今天（明日及之后）
 * @param {string} dateStr YYYY-MM-DD
 * @returns {boolean}
 */
function isAfterToday(dateStr) {
  return dateStr > formatDate(new Date());
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

function isImageRef(value) {
  if (typeof value !== 'string' || !value) return false;
  if (value.indexOf('data:image') === 0) return false;
  if (value.length > 600) return false;
  return value.indexOf('cloud://') === 0
    || value.indexOf('http://') === 0
    || value.indexOf('https://') === 0;
}

function normalizeRecordImages(record = {}) {
  const values = []
    .concat(Array.isArray(record.imageUrls) ? record.imageUrls : [])
    .concat(Array.isArray(record.images) ? record.images : [])
    .concat([record.fileid, record.imageId, record.imageID, record.imageUrl, record.image, record.fileID, record.fileId]);
  const result = [];
  values.forEach((value) => {
    if (isImageRef(value) && result.indexOf(value) < 0) {
      result.push(value);
    }
  });
  return result;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function normalizeCheckinTagName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_CHECKIN_TAG_LENGTH);
}

function normalizeCheckinTagNames(tags, fallback = DEFAULT_CHECKIN_TAG_OPTIONS) {
  const source = Array.isArray(tags) ? tags : fallback;
  const result = [];
  source.forEach((tag) => {
    const name = normalizeCheckinTagName(tag);
    if (name && result.indexOf(name) < 0) {
      result.push(name);
    }
  });
  return result.length ? result.slice(0, MAX_CHECKIN_TAG_OPTIONS) : fallback.slice();
}

function getUserCheckinTagNames(userInfo = {}) {
  return normalizeCheckinTagNames(userInfo.checkinTagOptions);
}

function buildCheckinTagOptions(selectedTags = [], optionNames = DEFAULT_CHECKIN_TAG_OPTIONS) {
  const names = normalizeCheckinTagNames(optionNames);
  normalizeCheckinTagNames(selectedTags, []).forEach((tag) => {
    if (names.indexOf(tag) < 0) {
      names.push(tag);
    }
  });

  return names.map((name) => ({
    name,
    selected: selectedTags.indexOf(name) >= 0
  }));
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
    monthLossValue: '--',
    totalCheckinDays: '--',
    monthCheckinDays: 0,
    targetText: '',
    targetDistanceValue: '--',
    aimWeightText: '--',
    targetProgress: 0,
    targetProgressDisplay: 0,
    monthlyAimWeight: null,
    monthlyTargetMonth: '',
    showMonthlyTargetDialog: false,
    monthlyTargetInput: '',
    monthlyTargetSaving: false,
    hasSelectedRecord: false,
    hasChartData: false,
    showOnboarding: false,
    showCheckinDialog: false,
    showCheckinSuccessDialog: false,
    showBmiDialog: false,
    showSharePanel: false,
    showShareNudge: false,
    showFavoriteGuide: false,
    visibleJoinGroup: false,
    moduleAnalysisReportEnabled: true,
    pendingAddToDesktopGuide: false,
    navBarStyle: '',
    navTitleStyle: '',
    favoriteButtonStyle: '',
    favoriteGuideArrowStyle: '',
    htmlImage: 'cloud://release-ba24f3.7265-release-ba24f3-1257780911/activity.png',
    bmiMarkerPosition: 0,
    sharePreviewText: '记录每天变化，一起打卡吧',
    subscribeChecked: true,
    reminderTime: '09:00',
    visibleReminderTimePicker: false,
    newUserHeight: '',
    newUserWeight: '',
    newUserTarget: '',
    checkinWeight: '',
    checkinWeightKg: '',
    checkinTagOptions: buildCheckinTagOptions(),
    userCheckinTagNames: DEFAULT_CHECKIN_TAG_OPTIONS.slice(),
    showCheckinTagManager: false,
    newCheckinTagName: '',
    checkinTags: [],
    checkinNote: '',
    checkinImages: [],
    checkinImageUploading: false,
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
    this.initCustomNav();
    this.loadModuleControls();
    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    App.initUserInfo(() => {
      this.applyReminderPreference();
      this.applyCheckinTagPreference();
      this.refreshAll();
    });
  },

  onShow() {
    this.loadModuleControls();
    if (App.globalData.userInfo && App.globalData.userInfo.openId) {
      this.applyReminderPreference();
      this.applyCheckinTagPreference();
      this.loadMonthlyTarget(this.data.currentMonth);
    }
  },

  onReady() {
    this.ecComponent = this.selectComponent('#trend-chart');
  },

  loadModuleControls() {
    CF.get('params', { code: HIDE_ANALYSIS_REPORT_CODE })
      .then((res) => {
        const rows = res.result && res.result.data ? res.result.data : [];
        const config = rows[0] || {};
        this.setData({
          moduleAnalysisReportEnabled: !normalizeBoolean(config.value, false)
        });
      })
      .catch(() => {
        this.setData({ moduleAnalysisReportEnabled: true });
      });
  },

  initCustomNav() {
    let systemInfo = {};
    let menuButton = null;
    try {
      systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
      menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    } catch (err) {
      systemInfo = {};
      menuButton = null;
    }

    const windowWidth = systemInfo.windowWidth || 375;
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const menuTop = menuButton && menuButton.top ? menuButton.top : statusBarHeight + 4;
    const menuHeight = menuButton && menuButton.height ? menuButton.height : 32;
    const menuBottom = menuButton && menuButton.bottom ? menuButton.bottom : menuTop + menuHeight;
    const capsuleLeft = menuButton && menuButton.left ? menuButton.left : windowWidth - 96;
    const capsuleSpace = Math.max(96, windowWidth - capsuleLeft);
    const favoriteWidth = 82;
    const favoriteRight = capsuleSpace + 8;

    this.setData({
      navBarStyle: `height:${menuBottom + 8}px;`,
      navTitleStyle: `top:${menuTop}px;height:${menuHeight}px;line-height:${menuHeight}px;right:${favoriteRight + favoriteWidth + 12}px;`,
      favoriteButtonStyle: `top:${menuTop}px;right:${favoriteRight}px;width:${favoriteWidth}px;height:${menuHeight}px;line-height:${menuHeight}px;`,
      favoriteGuideArrowStyle: `top:${menuBottom + 2}px;right:${capsuleSpace + 32}px;`
    });
  },

  refreshAll() {
    this.loadMonthlyTarget(this.data.currentMonth);
    this.loadMonthRecords();
    this.loadLastRecordForOnboarding();
    this.loadTotalCheckinDays();
  },

  getCurrentAimWeight() {
    return toNumber(this.data.monthlyAimWeight)
      || toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
  },

  loadMonthlyTarget(month = this.data.currentMonth) {
    if (!month) return Promise.resolve();
    const fallbackTarget = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
    return CF.get('monthlyTargets', {
      openId: true,
      month
    }).then((res) => {
      if (this.data.currentMonth !== month) return;
      const rows = res.result && res.result.data ? res.result.data : [];
      const record = rows[0] || {};
      const aimWeight = toNumber(record.aimWeight) || fallbackTarget || null;
      this.setData({
        monthlyAimWeight: aimWeight,
        monthlyTargetMonth: month,
        monthlyTargetInput: aimWeight ? formatWeight(aimWeight) : ''
      }, () => {
        this.updateOverview();
        this.initTrendChart();
      });
    }).catch((err) => {
      console.error('本月目标加载失败:', err);
      if (this.data.currentMonth !== month) return;
      this.setData({
        monthlyAimWeight: fallbackTarget || null,
        monthlyTargetMonth: month,
        monthlyTargetInput: fallbackTarget ? formatWeight(fallbackTarget) : ''
      }, () => {
        this.updateOverview();
        this.initTrendChart();
      });
    });
  },

  applyReminderPreference() {
    const preference = getCheckinReminderPreference(App.globalData.userInfo || {});
    this.setData({
      subscribeChecked: true,
      reminderTime: preference.time
    });
  },

  applyCheckinTagPreference() {
    const tagNames = getUserCheckinTagNames(App.globalData.userInfo || {});
    this.setData({
      userCheckinTagNames: tagNames,
      checkinTagOptions: buildCheckinTagOptions(this.data.checkinTags || [], tagNames)
    });
  },

  persistCheckinTagPreference(tagNames, selectedTags = this.data.checkinTags || []) {
    const nextTags = normalizeCheckinTagNames(tagNames);
    App.globalData.userInfo = {
      ...(App.globalData.userInfo || {}),
      checkinTagOptions: nextTags
    };

    this.setData({
      userCheckinTagNames: nextTags,
      checkinTagOptions: buildCheckinTagOptions(selectedTags, nextTags)
    });

    return wx.cloud.callFunction({
      name: 'update',
      data: {
        tbName: 'users',
        query: { openId: true },
        data: { checkinTagOptions: nextTags }
      }
    }).catch((err) => {
      console.error('打卡标签偏好保存失败:', err);
      wx.showToast({ title: '标签保存失败，请稍后再试', icon: 'none' });
    });
  },

  persistReminderPreference() {
    const updateData = buildCheckinReminderUpdate(this.data.subscribeChecked, this.data.reminderTime);
    App.globalData.userInfo = {
      ...(App.globalData.userInfo || {}),
      ...updateData
    };

    return wx.cloud.callFunction({
      name: 'update',
      data: {
        tbName: 'users',
        query: { openId: true },
        data: updateData
      }
    }).catch((err) => {
      console.error('打卡提醒偏好保存失败:', err);
    });
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
    const currentMonth = this.data.currentMonth;
    const dateRange = getExpandedMonthRange(currentMonth);
    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: currentMonth,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }
    }).then((res) => {
      if (this.data.currentMonth !== currentMonth) return;
      const calendarRecords = ((res.result && res.result.data) || [])
        .filter((item) => item && item.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      const records = calendarRecords.filter((item) => item.date.indexOf(currentMonth) === 0);
      this.applyRecords(records, calendarRecords);
    }).catch(() => {
      wx.showToast({ title: '加载失败，请稍后再试', icon: 'none' });
    });
  },

  buildRecordsMap(records) {
    const recordsMap = {};
    records.forEach((record) => {
      if (record.weight) {
        recordsMap[record.date] = {
          ...record,
          weight: formatWeight(record.weight)
        };
      }
    });
    return recordsMap;
  },

  applyRecords(records, calendarRecords = records) {
    const recordsMap = this.buildRecordsMap(calendarRecords);

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
    const aimWeight = this.getCurrentAimWeight();
    const displayWeight = latest ? formatWeight(latest.weight) : '';
    const bmiInfo = this.getBmiInfo(displayWeight, height);
    const previous = this.getPreviousRecord(latest);
    const changeInfo = this.getChangeInfo(latest, previous, '较上次');
    const monthChangeInfo = this.getMonthChangeInfo(records);
    const targetInfo = this.getTargetInfo(records, latest, aimWeight);
    const selectedTags = selected && Array.isArray(selected.tags) ? selected.tags : [];
    const selectedImages = normalizeRecordImages(selected).map((url) => ({
      url,
      fileId: url,
      isLocal: false
    }));
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
      checkinWeightKg: selected && selected.weight ? formatWeight(toNumber(selected.weight) / 2) : '',
      checkinTagOptions: buildCheckinTagOptions(selectedTags, this.data.userCheckinTagNames),
      checkinTags: selectedTags,
      checkinNote: selected && selected.note ? selected.note : '',
      checkinImages: selectedImages
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
    const aimWeight = this.getCurrentAimWeight();
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
    const aimWeight = this.getCurrentAimWeight();
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
    const selectedDate = getDefaultSelectedDate(currentMonth);
    this.setData({ currentMonth, selectedDate }, () => {
      this.loadMonthlyTarget(currentMonth);
      this.loadMonthRecords();
    });
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
    const isFuture = isAfterToday(selectedDate);
    const selectedTags = selected && Array.isArray(selected.tags) ? selected.tags : [];
    const selectedImages = normalizeRecordImages(selected).map((url) => ({
      url,
      fileId: url,
      isLocal: false
    }));
    this.setData({
      selectedDate,
      hasSelectedRecord: !!selected,
      checkinWeight: selected ? selected.weight : '',
      checkinWeightKg: selected && selected.weight ? formatWeight(toNumber(selected.weight) / 2) : '',
      checkinTagOptions: buildCheckinTagOptions(selectedTags, this.data.userCheckinTagNames),
      checkinTags: selectedTags,
      checkinNote: selected && selected.note ? selected.note : '',
      checkinImages: selectedImages
    }, () => {
      this.updateOverview();
      if (isFuture) {
        if (!selected) {
          wx.showToast({ title: '不能为未来日期打卡', icon: 'none' });
        }
        return;
      }
      this.openCheckin();
    });
  },

  goRecords() {
    wx.navigateTo({
      url: `/pages/recordsV2/records?month=${this.data.currentMonth}`
    });
  },

  goAnalysis() {
    if (!this.data.moduleAnalysisReportEnabled) {
      wx.showToast({ title: '数据分析暂未开放', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/analysis/analysis?month=${this.data.currentMonth}`
    });
  },

  goUserInfoTarget() {
    const aimWeight = this.getCurrentAimWeight();
    this.setData({
      showMonthlyTargetDialog: true,
      monthlyTargetInput: aimWeight ? formatWeight(aimWeight) : ''
    });
  },

  closeMonthlyTargetDialog() {
    this.setData({
      showMonthlyTargetDialog: false,
      monthlyTargetSaving: false
    });
  },

  onMonthlyTargetInput(e) {
    this.setData({
      monthlyTargetInput: getFieldValue(e) || ''
    });
  },

  saveMonthlyTarget() {
    if (this.data.monthlyTargetSaving) return;
    const aimWeight = toNumber(this.data.monthlyTargetInput);
    if (!aimWeight || aimWeight <= 0) {
      wx.showToast({ title: '请输入有效目标', icon: 'none' });
      return;
    }

    const month = this.data.currentMonth;
    const aimWeightKg = Number((aimWeight / 2).toFixed(2));
    this.setData({ monthlyTargetSaving: true });

    wx.cloud.callFunction({
      name: 'updateOrInsert',
      data: {
        tbName: 'monthlyTargets',
        query: {
          openId: true,
          month
        },
        data: {
          month,
          aimWeight,
          aimWeightKg,
          updatedAt: new Date()
        }
      }
    }).then(() => {
      if (month !== formatMonth(new Date())) {
        return null;
      }
      return CF.update('users', { openId: true }, {
        aimWeight,
        aimWeightKg
      });
    }).then(() => {
      if (month === formatMonth(new Date())) {
        App.globalData.userInfo = {
          ...(App.globalData.userInfo || {}),
          aimWeight,
          aimWeightKg
        };
      }
      this.setData({
        monthlyAimWeight: aimWeight,
        monthlyTargetMonth: month,
        monthlyTargetInput: formatWeight(aimWeight),
        showMonthlyTargetDialog: false,
        monthlyTargetSaving: false
      }, () => {
        this.updateOverview();
        this.initTrendChart();
      });
      wx.showToast({ title: '目标已保存', icon: 'success' });
    }).catch((err) => {
      console.error('本月目标保存失败:', err);
      this.setData({ monthlyTargetSaving: false });
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  },

  openCheckin() {
    if (isAfterToday(this.data.selectedDate)) {
      wx.showToast({ title: '不能为未来日期打卡', icon: 'none' });
      return;
    }
    const weight = toNumber(this.data.checkinWeight);
    this.setData({
      showCheckinDialog: true,
      subscribeChecked: true,
      checkinWeightKg: weight ? formatWeight(weight / 2) : this.data.checkinWeightKg
    });
  },

  closeCheckin() {
    this.setData({
      showCheckinDialog: false,
      visibleReminderTimePicker: false,
      showCheckinTagManager: false,
      newCheckinTagName: '',
      checkinImageUploading: false
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

  onToggleCheckinTag(e) {
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    const selectedTags = this.data.checkinTags || [];
    const exists = selectedTags.indexOf(tag) >= 0;
    const nextTags = exists
      ? selectedTags.filter((item) => item !== tag)
      : selectedTags.concat([tag]);
    this.setData({
      checkinTagOptions: buildCheckinTagOptions(nextTags, this.data.userCheckinTagNames),
      checkinTags: nextTags
    });
  },

  toggleCheckinTagManager() {
    this.setData({
      showCheckinTagManager: !this.data.showCheckinTagManager,
      newCheckinTagName: ''
    });
  },

  onNewCheckinTagInput(e) {
    this.setData({
      newCheckinTagName: e.detail.value || ''
    });
  },

  addCheckinTagOption() {
    const name = normalizeCheckinTagName(this.data.newCheckinTagName);
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' });
      return;
    }

    const tagNames = this.data.userCheckinTagNames || [];
    if (tagNames.indexOf(name) >= 0) {
      wx.showToast({ title: '这个标签已存在', icon: 'none' });
      this.setData({ newCheckinTagName: '' });
      return;
    }

    if (tagNames.length >= MAX_CHECKIN_TAG_OPTIONS) {
      wx.showToast({ title: `最多保留${MAX_CHECKIN_TAG_OPTIONS}个标签`, icon: 'none' });
      return;
    }

    this.persistCheckinTagPreference(tagNames.concat([name])).then(() => {
      this.setData({ newCheckinTagName: '' });
    });
  },

  removeCheckinTagOption(e) {
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;

    const nextTagNames = (this.data.userCheckinTagNames || [])
      .filter((item) => item !== tag);
    const nextSelectedTags = (this.data.checkinTags || [])
      .filter((item) => item !== tag);

    this.setData({
      checkinTags: nextSelectedTags
    });
    this.persistCheckinTagPreference(nextTagNames, nextSelectedTags);
  },

  onCheckinNoteInput(e) {
    this.setData({
      checkinNote: e.detail.value || ''
    });
  },

  chooseCheckinImages() {
    const remaining = MAX_CHECKIN_IMAGES - this.data.checkinImages.length;
    if (remaining <= 0) {
      wx.showToast({ title: `最多添加${MAX_CHECKIN_IMAGES}张`, icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths || [];
        const nextImages = tempFilePaths.map((url) => ({
          url,
          fileId: '',
          isLocal: true
        }));
        this.setData({
          checkinImages: this.data.checkinImages.concat(nextImages).slice(0, MAX_CHECKIN_IMAGES)
        });
      }
    });
  },

  removeCheckinImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const checkinImages = this.data.checkinImages.slice();
    checkinImages.splice(index, 1);
    this.setData({ checkinImages });
  },

  previewCheckinImage(e) {
    const current = e.currentTarget.dataset.url;
    if (!current) return;
    const urls = this.data.checkinImages.map((item) => item.url).filter(Boolean);
    wx.previewImage({ current, urls });
  },

  uploadCheckinImage(item, index) {
    if (!item || !item.isLocal) {
      return Promise.resolve(item.fileId || item.url);
    }
    const openId = App.globalData.userInfo && App.globalData.userInfo.openId;
    if (!openId) {
      return Promise.reject(new Error('missing openId'));
    }
    const extMatch = item.url.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : '.jpg';
    const suffix = MAX_CHECKIN_IMAGES > 1 ? `_${index}` : '';
    const cloudPath = `${openId}/${this.data.selectedDate}_${Date.now()}${suffix}${ext}`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: item.url,
        success: (res) => {
          if (res.fileID) {
            resolve(res.fileID);
          } else {
            reject(new Error('missing fileID'));
          }
        },
        fail: reject
      });
    });
  },

  uploadCheckinImagesIfNeeded() {
    const images = this.data.checkinImages || [];
    this.setData({ checkinImageUploading: true });
    return Promise.all(images.map((item, index) => this.uploadCheckinImage(item, index)))
      .then((imageUrls) => {
        const nextImages = imageUrls.map((url) => ({
          url,
          fileId: url,
          isLocal: false
        }));
        this.setData({
          checkinImages: nextImages,
          checkinImageUploading: false
        });
        return imageUrls;
      })
      .catch((err) => {
        console.error('身材记录照片保存失败:', err);
        this.setData({ checkinImageUploading: false });
        const uploadError = new Error('image upload failed');
        uploadError.isImageUpload = true;
        throw uploadError;
      });
  },

  onSubscribeCheckboxChange(event) {
    this.setData({
      subscribeChecked: event.detail
    }, () => {
      this.persistReminderPreference();
    });
  },

  showReminderTimePicker() {
    this.setData({
      visibleReminderTimePicker: true
    });
  },

  onReminderTimeConfirm(event) {
    const formattedTime = normalizeCheckinReminderTime(event.detail);
    this.setData({
      reminderTime: formattedTime,
      visibleReminderTimePicker: false
    }, () => {
      this.persistReminderPreference();
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

  openFavoriteGuide() {
    this.setData({ showFavoriteGuide: true });
  },

  closeFavoriteGuide() {
    this.setData({ showFavoriteGuide: false }, () => {
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
    this.persistReminderPreference();
    if (!this.data.subscribeChecked || !wx.requestSubscribeMessage) return;
    wx.requestSubscribeMessage({
      tmplIds: [CHECKIN_SUBSCRIBE_TEMPLATE_ID],
      success: (res) => {
        if (res.errMsg !== 'requestSubscribeMessage:ok') return;
        const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
        const formattedTime = normalizeCheckinReminderTime(this.data.reminderTime);
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
      aimWeightKg: Number((target / 2).toFixed(2)),
      ...buildCheckinReminderUpdate(this.data.subscribeChecked, this.data.reminderTime)
    };

    this.requestCheckinSubscribe();

    CF.update('users', { openId: true }, updateData)
      .then(() => wx.cloud.callFunction({
        name: 'updateOrInsert',
        data: {
          tbName: 'monthlyTargets',
          query: {
            openId: true,
            month: formatMonth(new Date())
          },
          data: {
            month: formatMonth(new Date()),
            aimWeight: target,
            aimWeightKg: updateData.aimWeightKg,
            updatedAt: new Date()
          }
        }
      }))
      .then(() => CF.insert('records', {
        date: formatDate(new Date()),
        weight,
        weightKg: Number((weight / 2).toFixed(2))
      }))
      .then(() => {
        App.globalData.userInfo.height = height;
        App.globalData.userInfo.aimWeight = target;
        App.globalData.userInfo.aimWeightKg = updateData.aimWeightKg;
        App.globalData.userInfo.checkinReminderEnabled = updateData.checkinReminderEnabled;
        App.globalData.userInfo.checkinReminderTime = updateData.checkinReminderTime;
        this.setData({
          monthlyAimWeight: target,
          monthlyTargetMonth: formatMonth(new Date()),
          monthlyTargetInput: formatWeight(target),
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
    if (isAfterToday(this.data.selectedDate)) {
      wx.showToast({ title: '不能为未来日期打卡', icon: 'none' });
      return;
    }
    const weight = toNumber(this.data.checkinWeight);
    if (!weight || weight <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }
    this.requestCheckinSubscribe();
    const isTodayCheckin = this.data.selectedDate === formatDate(new Date());
    wx.showLoading({ title: '保存中', mask: true });

    this.uploadCheckinImagesIfNeeded().then((imageUrls) => {
      const data = {
        date: this.data.selectedDate,
        weight,
        weightKg: Number((weight / 2).toFixed(2)),
        tags: this.data.checkinTags || [],
        note: (this.data.checkinNote || '').trim(),
        fileid: imageUrls[0] || ''
      };
      return (!this.data.hasSelectedRecord
        ? CF.insert('records', data)
        : CF.update('records', { openId: true, date: this.data.selectedDate }, data)
      ).then(() => data);
    }).then((data) => {
      wx.hideLoading();
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
    }).catch((err) => {
      console.error('打卡保存失败:', err);
      wx.hideLoading();
      wx.showToast({ title: err && err.isImageUpload ? '照片保存失败' : '保存失败，请重试', icon: 'none' });
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
