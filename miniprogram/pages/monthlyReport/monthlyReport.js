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

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function getReportContext(options = {}) {
  const scope = options.scope === 'year' || options.scope === 'all' ? options.scope : 'month';
  const month = options.month || formatMonth(new Date());
  const year = options.year || month.slice(0, 4) || getCurrentYear();
  if (scope === 'year') {
    return {
      scope,
      month,
      year,
      periodLabel: `${year}年`,
      reportName: '年度报告',
      nextActionTitle: '下一阶段行动'
    };
  }
  if (scope === 'all') {
    return {
      scope,
      month,
      year,
      periodLabel: '全部记录',
      reportName: '历史报告',
      nextActionTitle: '长期行动'
    };
  }
  return {
    scope,
    month,
    year: month.slice(0, 4),
    periodLabel: getMonthLabel(month),
    reportName: '月度报告',
    nextActionTitle: '下月行动'
  };
}

function getReportStyle(options = {}) {
  if (options.style === 'encourage' || options.reportStyle === 'encourage') {
    return { value: 'encourage', label: '鼓励', encouragementTitle: '给自己的鼓励' };
  }
  if (options.style === 'roast' || options.reportStyle === 'roast') {
    return { value: 'roast', label: '毒舌', encouragementTitle: '损友寄语' };
  }
  return { value: 'professional', label: '专业', encouragementTitle: '行动寄语' };
}

function getDefaultReport(context) {
  return {
    source: 'loading',
    overview: {
      title: `${context.reportName}分析`,
      summary: '正在整理报告...',
      tag: '整理中',
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
      title: `${context.periodLabel}${context.reportName}分析`,
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

function normalizeReport(report, context) {
  const safe = report || {};
  const metrics = safe.metrics || {};
  const weightChange = toNumber(metrics.weightChange);
  const targetDistance = toNumber(metrics.targetDistance);

  return {
    ...getDefaultReport(context),
    ...safe,
    overview: {
      ...getDefaultReport(context).overview,
      ...(safe.overview || {})
    },
    metrics: {
      ...getDefaultReport(context).metrics,
      ...metrics
    },
    trend: {
      ...getDefaultReport(context).trend,
      ...(safe.trend || {})
    },
    habit: {
      ...getDefaultReport(context).habit,
      ...(safe.habit || {})
    },
    insights: Array.isArray(safe.insights) ? safe.insights : [],
    nextActions: Array.isArray(safe.nextActions) ? safe.nextActions : [],
    share: {
      ...getDefaultReport(context).share,
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
    currentYear: getCurrentYear(),
    scope: 'month',
    periodLabel: getMonthLabel(formatMonth(new Date())),
    reportName: '月度报告',
    nextActionTitle: '下月行动',
    reportStyle: 'professional',
    reportStyleLabel: '专业',
    encouragementTitle: '行动寄语',
    reportId: '',
    sharedReportId: '',
    isSharedReport: false,
    loading: true,
    reportSourceText: '整理中',
    report: getDefaultReport(getReportContext())
  },

  onLoad(options) {
    const context = getReportContext(options);
    const reportStyle = getReportStyle(options);
    const sharedReportId = options.reportId || options.id || '';
    this.setData({
      currentMonth: context.month,
      currentYear: context.year,
      scope: context.scope,
      periodLabel: context.periodLabel,
      reportName: context.reportName,
      nextActionTitle: context.nextActionTitle,
      reportStyle: reportStyle.value,
      reportStyleLabel: reportStyle.label,
      encouragementTitle: reportStyle.encouragementTitle,
      sharedReportId,
      isSharedReport: !!sharedReportId,
      report: getDefaultReport(context)
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
      reportSourceText: force ? '重新整理中' : '整理中'
    });

    const data = this.data.sharedReportId && !force
      ? { reportId: this.data.sharedReportId }
      : {
          scope: this.data.scope,
          month: this.data.currentMonth,
          year: this.data.currentYear,
          style: this.data.reportStyle,
          force
        };

    wx.cloud.callFunction({
      name: 'generateMonthlyReport',
      data
    }).then((res) => {
      const result = res.result || {};
      const context = getReportContext({
        scope: result.report && result.report.scope ? result.report.scope : this.data.scope,
        month: result.report && result.report.month ? result.report.month : this.data.currentMonth,
        year: result.report && result.report.year ? result.report.year : this.data.currentYear
      });
      const reportStyle = getReportStyle({
        style: result.report && result.report.reportStyle ? result.report.reportStyle : this.data.reportStyle
      });
      const report = normalizeReport(result.report, context);
      this.setData({
        loading: false,
        scope: context.scope,
        currentMonth: context.month,
        currentYear: context.year,
        periodLabel: context.periodLabel,
        reportName: context.reportName,
        nextActionTitle: context.nextActionTitle,
        reportStyle: reportStyle.value,
        reportStyleLabel: reportStyle.label,
        encouragementTitle: reportStyle.encouragementTitle,
        reportId: result.reportId || this.data.reportId,
        isSharedReport: !!result.shared,
        report,
        reportSourceText: result.source === 'saved'
          ? '已保存报告'
          : result.source === 'ai' || report.source === 'ai'
            ? '分析报告'
            : '基础分析'
      });
      if (!result.ok && result.errMsg) {
        wx.showToast({ title: '报告暂不可用，已展示基础分析', icon: 'none' });
      }
    }).catch(() => {
      const context = getReportContext({
        scope: this.data.scope,
        month: this.data.currentMonth,
        year: this.data.currentYear
      });
      this.setData({
        loading: false,
        report: normalizeReport(null, context),
        reportSourceText: '基础分析'
      });
      wx.showToast({ title: '报告整理失败', icon: 'none' });
    });
  },

  regenerateReport() {
    if (this.data.loading) return;
    wx.showModal({
      title: '刷新分析报告',
      content: `会基于当前数据重新整理，并覆盖当前${this.data.reportName}。`,
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
      title: this.data.report.share.title || `${this.data.periodLabel}${this.data.reportName}分析`,
      path: reportId
        ? `/pages/monthlyReport/monthlyReport?reportId=${reportId}`
        : `/pages/monthlyReport/monthlyReport?scope=${this.data.scope}&month=${this.data.currentMonth}&year=${this.data.currentYear}&style=${this.data.reportStyle}`
    };
  },

  onShareTimeline() {
    const reportId = this.data.reportId || this.data.sharedReportId;
    return {
      title: this.data.report.share.summary || this.data.report.share.title || `${this.data.periodLabel}${this.data.reportName}分析`,
      query: reportId ? `reportId=${reportId}` : `scope=${this.data.scope}&month=${this.data.currentMonth}&year=${this.data.currentYear}&style=${this.data.reportStyle}`
    };
  }
});
