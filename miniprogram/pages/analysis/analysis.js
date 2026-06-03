import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import { cloud as CF } from '../../utils/cloudFunctionPromise.js';

const App = getApp();
const REWARDED_AD_UNIT_ID = 'adunit-5b1f040ecca8e89c';
const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function toNumber(value) {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function formatWeight(value) {
  const num = toNumber(value);
  if (num === null) return '--';
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

function getMonthLabel(month) {
  return dayjs(`${month}-01`).format('YYYY年MM月');
}

function getYearLabel(year) {
  return `${year}年`;
}

Page({
  data: {
    scope: 'month',
    currentMonth: formatMonth(new Date()),
    currentYear: getCurrentYear(),
    periodTitle: getMonthLabel(formatMonth(new Date())),
    periodSubtitle: '体重、BMI、打卡习惯分析',
    reportTitle: 'AI 月度报告',
    reportSubtitle: '看完激励广告后生成，可分享朋友圈',
    reportButtonText: '生成',
    records: [],
    allRecords: [],
    summary: {
      days: 0,
      changeText: '--',
      changeClass: '',
      avgWeight: '--',
      latestBmi: '--'
    },
    scoreTitle: '等待记录',
    scoreDesc: '记录越完整，分析越准确。',
    habitScore: 0,
    weekdayStats: weekNames.map((name) => ({ name, count: 0, percent: 0 })),
    insights: [],
    hasChartData: false,
    ec: {
      lazyLoad: true
    }
  },

  onLoad(options) {
    const currentMonth = options.month || this.data.currentMonth;
    const currentYear = options.year || currentMonth.slice(0, 4) || this.data.currentYear;
    const scope = options.scope === 'year' || options.scope === 'all' ? options.scope : 'month';
    this.setData({
      scope,
      currentMonth,
      currentYear
    }, () => {
      this.updatePeriodText();
      if (App.initUserInfo) {
        App.initUserInfo(() => this.loadRecords());
      } else {
        this.loadRecords();
      }
    });
    this.initRewardedAd();
  },

  onReady() {
    this.ecComponent = this.selectComponent('#analysis-chart');
  },

  initRewardedAd() {
    if (!REWARDED_AD_UNIT_ID || !wx.createRewardedVideoAd) return;
    this.rewardedAd = wx.createRewardedVideoAd({
      adUnitId: REWARDED_AD_UNIT_ID
    });
    this.rewardedAd.onClose((res) => {
      if (res && res.isEnded) {
        this.goAiReport();
      } else {
        wx.showToast({ title: '完整观看后才能生成报告', icon: 'none' });
      }
    });
    this.rewardedAd.onError(() => {
      wx.showToast({ title: '广告暂时不可用，请稍后再试', icon: 'none' });
    });
  },

  updatePeriodText() {
    const scope = this.data.scope;
    const map = {
      month: {
        periodTitle: getMonthLabel(this.data.currentMonth),
        periodSubtitle: '本月体重、BMI、打卡习惯分析',
        reportTitle: 'AI 月度报告',
        reportSubtitle: '基于本月记录生成，可分享朋友圈'
      },
      year: {
        periodTitle: getYearLabel(this.data.currentYear),
        periodSubtitle: '今年趋势、节奏和关键变化分析',
        reportTitle: 'AI 年度报告',
        reportSubtitle: '基于今年记录生成年度总结'
      },
      all: {
        periodTitle: '全部记录',
        periodSubtitle: '长期体重变化和打卡习惯分析',
        reportTitle: 'AI 全部报告',
        reportSubtitle: '基于全部历史记录生成长期分析'
      }
    };
    this.setData({
      ...map[scope],
      reportButtonText: '生成'
    });
  },

  loadRecords() {
    if (this.data.scope === 'month') {
      this.loadMonthRecords();
      return;
    }
    this.loadAllRecords();
  },

  loadMonthRecords() {
    wx.cloud.callFunction({
      name: 'getWeightRecordsByMonth',
      data: {
        month: this.data.currentMonth
      }
    }).then((res) => {
      const records = this.normalizeRecords((res.result && res.result.data) || []);
      this.applyRecords(records);
    }).catch(() => {
      wx.showToast({ title: '分析加载失败', icon: 'none' });
    });
  },

  loadAllRecords() {
    const applyFromAll = (records) => {
      const source = this.data.scope === 'year'
        ? records.filter((item) => item.date.indexOf(`${this.data.currentYear}-`) === 0)
        : records;
      this.applyRecords(source);
    };

    if (this.data.allRecords.length) {
      applyFromAll(this.data.allRecords);
      return;
    }

    CF.listAll('records', { openId: true }, 'date', 'asc', 10000).then((res) => {
      const result = res.result || {};
      const allRecords = this.normalizeRecords(result.data || []);
      this.setData({ allRecords }, () => applyFromAll(allRecords));
      if (result.hasMore) {
        wx.showToast({ title: '记录较多，已显示前10000条', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '分析加载失败', icon: 'none' });
    });
  },

  normalizeRecords(records) {
    return (records || [])
      .filter((item) => item && item.date && item.weight)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  applyRecords(records) {
    this.setData({
      records,
      summary: this.buildSummary(records),
      habitScore: this.buildHabitScore(records),
      weekdayStats: this.buildWeekdayStats(records),
      insights: this.buildInsights(records),
      hasChartData: records.length > 1
    }, () => {
      this.updateScoreText();
      this.initChart();
    });
  },

  buildSummary(records) {
    if (!records.length) {
      return {
        days: 0,
        changeText: '--',
        changeClass: '',
        avgWeight: '--',
        latestBmi: '--'
      };
    }

    const height = toNumber(App.globalData.userInfo && App.globalData.userInfo.height);
    const weights = records.map((item) => toNumber(item.weight)).filter((item) => item !== null);
    const first = weights[0];
    const latest = weights[weights.length - 1];
    const diff = latest - first;
    const avg = weights.reduce((sum, item) => sum + item, 0) / weights.length;
    const bmi = latest && height ? latest / 2 / (height * height / 10000) : null;

    return {
      days: records.length,
      changeText: records.length > 1 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}斤` : '首条记录',
      changeClass: diff > 0 ? 'up' : diff < 0 ? 'down' : '',
      avgWeight: `${formatWeight(avg)}斤`,
      latestBmi: bmi ? bmi.toFixed(2) : '--'
    };
  },

  buildHabitScore(records) {
    if (!records.length) return 0;
    const periodDays = this.getScorePeriodDays(records);
    const checkinScore = Math.min(70, Math.round((records.length / periodDays) * 70));
    const stabilityScore = this.getStableDays(records) >= 7 ? 30 : Math.min(30, this.getStableDays(records) * 4);
    return Math.min(100, checkinScore + stabilityScore);
  },

  getScorePeriodDays(records) {
    if (this.data.scope === 'month') {
      return dayjs(`${this.data.currentMonth}-01`).daysInMonth();
    }
    if (this.data.scope === 'year') {
      const year = Number(this.data.currentYear);
      return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    }
    if (records.length < 2) return 1;
    return Math.max(dayjs(records[records.length - 1].date).diff(dayjs(records[0].date), 'day') + 1, 1);
  },

  getStableDays(records) {
    if (!records.length) return 0;
    const dates = records.map((item) => item.date);
    let longest = 1;
    let current = 1;
    for (let index = 1; index < dates.length; index += 1) {
      const prev = dayjs(dates[index - 1]);
      const currentDate = dayjs(dates[index]);
      if (currentDate.diff(prev, 'day') === 1) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }
    return longest;
  },

  buildWeekdayStats(records) {
    const counts = weekNames.map((name) => ({ name, count: 0, percent: 0 }));
    records.forEach((record) => {
      const index = new Date(record.date.replace(/-/g, '/')).getDay();
      counts[index].count += 1;
    });
    const max = Math.max(...counts.map((item) => item.count), 1);
    return counts.map((item) => ({
      ...item,
      percent: Math.round((item.count / max) * 100)
    }));
  },

  buildInsights(records) {
    const scopeText = this.data.scope === 'month'
      ? '本月'
      : this.data.scope === 'year'
        ? '今年'
        : '长期';
    if (!records.length) {
      return [`${scopeText}暂无记录，先完成 3 次以上记录，系统就能看出基础趋势。`];
    }
    const insights = [];
    const weights = records.map((item) => toNumber(item.weight)).filter((item) => item !== null);
    const diff = weights[weights.length - 1] - weights[0];
    const stableDays = this.getStableDays(records);

    if (records.length >= 2) {
      if (diff < 0) {
        insights.push(`${scopeText}体重下降 ${Math.abs(diff).toFixed(1)} 斤，继续保持当前节奏。`);
      } else if (diff > 0) {
        insights.push(`${scopeText}体重上升 ${diff.toFixed(1)} 斤，建议优先稳定饮食和睡眠。`);
      } else {
        insights.push(`${scopeText}体重基本持平，可以通过运动量或饮食结构做小幅优化。`);
      }
    } else {
      insights.push(`${scopeText}只有 1 次记录，先积累到 2 次以上再看变化。`);
    }

    if (stableDays >= 7) {
      insights.push(`最长连续记录 ${stableDays} 天，习惯已经开始成型。`);
    } else {
      insights.push('建议先把连续记录做到 7 天，数据连续后更容易发现问题。');
    }

    if (records.length < 10) {
      insights.push('记录次数偏少，不必急着追求大变化，先让数据完整起来。');
    }

    return insights;
  },

  updateScoreText() {
    const score = this.data.habitScore;
    let scoreTitle = '等待记录';
    let scoreDesc = '记录越完整，分析越准确。';
    if (score >= 80) {
      scoreTitle = '执行稳定';
      scoreDesc = '记录习惯不错，AI 报告会更有参考价值。';
    } else if (score >= 50) {
      scoreTitle = '正在变稳';
      scoreDesc = '已经有趋势了，再补一点连续性会更好。';
    } else if (score > 0) {
      scoreTitle = '刚刚开始';
      scoreDesc = '先别追求完美，保持记录比偶尔用力更重要。';
    }
    this.setData({ scoreTitle, scoreDesc });
  },

  initChart() {
    const records = this.data.records;
    if (records.length < 2) {
      this.ecComponent = null;
      this.chart = null;
      return;
    }

    wx.nextTick(() => {
      this.ecComponent = this.selectComponent('#analysis-chart');
      if (!this.ecComponent) return;

      const xData = records.map((item) => {
        if (this.data.scope === 'month') return dayjs(item.date).format('DD');
        if (this.data.scope === 'year') return dayjs(item.date).format('MM/DD');
        return dayjs(item.date).format('YY/MM/DD');
      });
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

      this.ecComponent.init((canvas, width, heightPx, dpr) => {
        if (!canvas || !width || !heightPx) return null;
        const chart = echarts.init(canvas, null, {
          width,
          height: heightPx,
          devicePixelRatio: dpr || 1
        });
        chart.setOption({
          color: ['#188be4'],
          grid: { left: 34, right: 42, top: 36, bottom: 28 },
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
    if (this.data.scope === 'all') return;
    if (this.data.scope === 'year') {
      const currentYear = String(Number(this.data.currentYear) + offset);
      this.setData({ currentYear }, () => {
        this.updatePeriodText();
        this.loadRecords();
      });
      return;
    }
    const date = dayjs(`${this.data.currentMonth}-01`).toDate();
    date.setMonth(date.getMonth() + offset);
    const currentMonth = formatMonth(date);
    this.setData({
      currentMonth,
      currentYear: currentMonth.slice(0, 4)
    }, () => {
      this.updatePeriodText();
      this.loadRecords();
    });
  },

  prevMonth() {
    this.shiftMonth(-1);
  },

  nextMonth() {
    this.shiftMonth(1);
  },

  changeScope(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope === this.data.scope) return;
    this.setData({ scope }, () => {
      this.updatePeriodText();
      this.loadRecords();
    });
  },

  watchReportAd() {
    if (!REWARDED_AD_UNIT_ID) {
      wx.showModal({
        title: '开发预览',
        content: '激励广告位 ID 尚未配置，当前直接进入 AI 报告。上线前填入广告位后会要求完整观看。',
        showCancel: false,
        success: () => this.goAiReport()
      });
      return;
    }
    if (!this.rewardedAd) {
      wx.showToast({ title: '广告初始化失败', icon: 'none' });
      return;
    }
    this.rewardedAd.show().catch(() => {
      this.rewardedAd.load().then(() => this.rewardedAd.show());
    });
  },

  goAiReport() {
    wx.navigateTo({
      url: `/pages/monthlyReport/monthlyReport?scope=${this.data.scope}&month=${this.data.currentMonth}&year=${this.data.currentYear}`
    });
  }
});
