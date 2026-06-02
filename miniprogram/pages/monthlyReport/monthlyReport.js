import dayjs from '../../utils/dayjs.min.js';

const App = getApp();

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
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

function formatChange(value) {
  const num = toNumber(value);
  if (num === null) return '--';
  return `${num > 0 ? '+' : ''}${formatWeight(num)}斤`;
}

function getMonthLabel(month) {
  return dayjs(`${month}-01`).format('YYYY年MM月');
}

function getDefaultReport(month) {
  return {
    source: 'loading',
    overview: {
      title: 'AI 月度报告',
      summary: '正在生成报告...',
      tag: '生成中',
      score: '--'
    },
    metrics: {
      checkinDays: 0,
      weightChange: null,
      latestWeight: null,
      minWeight: null,
      maxWeight: null,
      targetDistance: null
    },
    trend: {
      description: '',
      highlights: []
    },
    habit: {
      summary: '',
      weekdayInsight: '',
      suggestion: ''
    },
    insights: [],
    nextActions: [],
    encouragement: '',
    share: {
      title: `${getMonthLabel(month)} AI 月度报告`,
      summary: ''
    },
    display: {
      days: '--',
      changeText: '--',
      changeClass: '',
      latestWeight: '--',
      targetText: '--',
      minWeight: '--',
      maxWeight: '--'
    }
  };
}

function normalizeReport(report, month) {
  const safe = report || {};
  const metrics = safe.metrics || {};
  const weightChange = toNumber(metrics.weightChange);
  const targetDistance = toNumber(metrics.targetDistance);

  return {
    ...getDefaultReport(month),
    ...safe,
    overview: {
      ...getDefaultReport(month).overview,
      ...(safe.overview || {})
    },
    metrics: {
      ...getDefaultReport(month).metrics,
      ...metrics
    },
    trend: {
      ...getDefaultReport(month).trend,
      ...(safe.trend || {})
    },
    habit: {
      ...getDefaultReport(month).habit,
      ...(safe.habit || {})
    },
    insights: Array.isArray(safe.insights) ? safe.insights : [],
    nextActions: Array.isArray(safe.nextActions) ? safe.nextActions : [],
    share: {
      ...getDefaultReport(month).share,
      ...(safe.share || {})
    },
    display: {
      days: metrics.checkinDays || 0,
      changeText: formatChange(weightChange),
      changeClass: weightChange > 0 ? 'up' : weightChange < 0 ? 'down' : '',
      latestWeight: `${formatWeight(metrics.latestWeight)}斤`,
      targetText: targetDistance === null
        ? '未设置'
        : targetDistance > 0
          ? `${formatWeight(targetDistance)}斤`
          : '已达成',
      minWeight: `${formatWeight(metrics.minWeight)}斤`,
      maxWeight: `${formatWeight(metrics.maxWeight)}斤`
    }
  };
}

Page({
  data: {
    currentMonth: formatMonth(new Date()),
    monthLabel: getMonthLabel(formatMonth(new Date())),
    reportId: '',
    sharedReportId: '',
    isSharedReport: false,
    loading: true,
    reportSourceText: 'AI 生成中',
    report: getDefaultReport(formatMonth(new Date()))
  },

  onLoad(options) {
    const currentMonth = options.month || this.data.currentMonth;
    const sharedReportId = options.reportId || options.id || '';
    this.setData({
      currentMonth,
      monthLabel: getMonthLabel(currentMonth),
      sharedReportId,
      isSharedReport: !!sharedReportId,
      report: getDefaultReport(currentMonth)
    });
    if (App.initUserInfo) {
      App.initUserInfo(() => this.loadAiReport());
    } else {
      this.loadAiReport();
    }
  },

  loadAiReport(force = false) {
    this.setData({
      loading: true,
      reportSourceText: force ? 'AI 重新生成中' : 'AI 生成中'
    });

    const data = this.data.sharedReportId && !force
      ? { reportId: this.data.sharedReportId }
      : {
          month: this.data.currentMonth,
          force
        };

    wx.cloud.callFunction({
      name: 'generateMonthlyReport',
      data
    }).then((res) => {
      const result = res.result || {};
      const report = normalizeReport(result.report, this.data.currentMonth);
      this.setData({
        loading: false,
        reportId: result.reportId || this.data.reportId,
        isSharedReport: !!result.shared,
        report,
        reportSourceText: result.source === 'saved'
          ? '已保存报告'
          : result.source === 'ai' || report.source === 'ai'
            ? 'AI 生成'
            : '智能兜底'
      });
      if (!result.ok && result.errMsg) {
        wx.showToast({ title: 'AI 暂不可用，已展示兜底报告', icon: 'none' });
      }
    }).catch(() => {
      this.setData({
        loading: false,
        report: normalizeReport(null, this.data.currentMonth),
        reportSourceText: '智能兜底'
      });
      wx.showToast({ title: '报告生成失败', icon: 'none' });
    });
  },

  regenerateReport() {
    if (this.data.loading) return;
    wx.showModal({
      title: '重新生成报告',
      content: '会基于当前数据重新调用 AI 生成，并覆盖本月已保存报告。',
      confirmColor: '#188be4',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            sharedReportId: '',
            isSharedReport: false
          }, () => this.loadAiReport(true));
        }
      }
    });
  },

  onShareAppMessage() {
    const reportId = this.data.reportId || this.data.sharedReportId;
    return {
      title: this.data.report.share.title || `${this.data.monthLabel} AI 月度报告`,
      path: reportId
        ? `/pages/monthlyReport/monthlyReport?reportId=${reportId}`
        : `/pages/monthlyReport/monthlyReport?month=${this.data.currentMonth}`
    };
  },

  onShareTimeline() {
    const reportId = this.data.reportId || this.data.sharedReportId;
    return {
      title: this.data.report.share.summary || this.data.report.share.title || `${this.data.monthLabel} AI 月度报告`,
      query: reportId ? `reportId=${reportId}` : `month=${this.data.currentMonth}`
    };
  }
});
