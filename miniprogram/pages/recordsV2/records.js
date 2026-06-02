import dayjs from '../../utils/dayjs.min.js';
import * as echarts from '../../ec-canvas/echarts';
import { cloud as CF } from '../../utils/cloudFunctionPromise.js';

const App = getApp();
const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

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

function getMonthLabel(month) {
  return dayjs(`${month}-01`).format('YYYY年MM月');
}

function getYearLabel(year) {
  return `${year}年`;
}

function getChangeText(current, previous) {
  if (!current || !previous) return { text: '', className: '' };
  const diff = toNumber(current.weight) - toNumber(previous.weight);
  if (!Number.isFinite(diff) || diff === 0) {
    return { text: '持平', className: '' };
  }
  return {
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`,
    className: diff > 0 ? 'up' : 'down'
  };
}

Page({
  data: {
    scope: 'month',
    currentMonth: formatMonth(new Date()),
    currentYear: String(new Date().getFullYear()),
    monthLabel: getMonthLabel(formatMonth(new Date())),
    periodTitle: getMonthLabel(formatMonth(new Date())),
    periodSubtitle: '加载中',
    summaryTitle: '本月变化',
    trendSubtitle: '按每日记录展示体重变化',
    chartGranularity: 'day',
    hasTrendData: false,
    ec: {
      lazyLoad: true
    },
    records: [],
    allRecords: [],
    displayRecords: [],
    archiveGroups: [],
    summary: {
      days: 0,
      latestWeight: '--',
      minWeight: '--',
      maxWeight: '--',
      changeText: '--',
      changeClass: '',
      noteText: '记录两次后显示变化',
      statusText: '先记录，再观察'
    },
    showEditDialog: false,
    editingRecord: {},
    editWeight: ''
  },

  onLoad(options) {
    const currentMonth = options.month || this.data.currentMonth;
    const currentYear = currentMonth.slice(0, 4);
    this.setData({
      currentMonth,
      currentYear,
      monthLabel: getMonthLabel(currentMonth),
      periodTitle: getMonthLabel(currentMonth)
    });
    if (App.initUserInfo) {
      App.initUserInfo(() => this.loadRecords());
    } else {
      this.loadRecords();
    }
  },

  onReady() {
    this.ecComponent = this.selectComponent('#records-chart');
  },

  loadRecords() {
    if (this.data.scope === 'month') {
      this.loadMonthRecords();
    } else {
      this.loadAllRecords();
    }
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
      wx.showToast({ title: '记录加载失败', icon: 'none' });
    });
  },

  loadAllRecords() {
    CF.listAll('records', { openId: true }, 'date', 'asc', 10000).then((res) => {
      const result = res.result || {};
      const allRecords = this.normalizeRecords(result.data || []);
      this.setData({ allRecords }, () => {
        this.applyArchiveRecords();
      });
      if (result.hasMore) {
        wx.showToast({ title: '记录较多，已显示前10000条', icon: 'none' });
      }
    }).catch(() => {
      wx.showToast({ title: '历史记录加载失败', icon: 'none' });
    });
  },

  normalizeRecords(records) {
    return (records || [])
      .filter((item) => item && item.date && item.weight)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  applyRecords(records) {
    const height = toNumber(App.globalData.userInfo && App.globalData.userInfo.height);
    const displayRecords = records.map((record, index) => {
      const previous = index > 0 ? records[index - 1] : null;
      const change = getChangeText(record, previous);
      const weight = toNumber(record.weight);
      const bmi = weight && height ? weight / 2 / (height * height / 10000) : null;

      return {
        ...record,
        day: dayjs(record.date).format('DD'),
        weekday: weekNames[new Date(record.date.replace(/-/g, '/')).getDay()],
        weight: formatWeight(record.weight),
        bmiText: bmi ? bmi.toFixed(2) : '',
        changeText: change.text,
        changeClass: change.className
      };
    }).reverse();

    this.setData({
      records,
      displayRecords,
      archiveGroups: [],
      summary: this.buildSummary(records),
      summaryTitle: '本月变化',
      trendSubtitle: '按每日记录展示体重变化',
      chartGranularity: 'day',
      hasTrendData: this.buildTrendPoints(records).length >= 2,
      periodTitle: getMonthLabel(this.data.currentMonth),
      periodSubtitle: `共 ${records.length} 天记录`
    }, () => this.initTrendChart(records));
  },

  applyArchiveRecords() {
    const source = this.data.scope === 'year'
      ? this.data.allRecords.filter((item) => item.date.indexOf(`${this.data.currentYear}-`) === 0)
      : this.data.allRecords;
    this.setData({
      records: source,
      displayRecords: [],
      archiveGroups: this.buildArchiveGroups(source),
      summary: this.buildSummary(source),
      summaryTitle: this.data.scope === 'year' ? '本年变化' : '累计变化',
      trendSubtitle: this.getTrendSubtitle(),
      hasTrendData: this.buildTrendPoints(source).length >= 2,
      periodTitle: this.data.scope === 'year' ? getYearLabel(this.data.currentYear) : '全部记录',
      periodSubtitle: this.data.scope === 'year' ? `共 ${source.length} 天记录` : `累计 ${source.length} 天记录`
    }, () => this.initTrendChart(source));
  },

  buildTrendPoints(records) {
    const validRecords = this.normalizeRecords(records);
    if (this.data.scope === 'month' || this.data.chartGranularity === 'day') {
      return validRecords.map((record) => ({
        label: this.data.scope === 'month'
          ? dayjs(record.date).format('DD')
          : this.data.scope === 'all'
            ? dayjs(record.date).format('YY/MM/DD')
            : dayjs(record.date).format('MM/DD'),
        value: toNumber(record.weight)
      })).filter((item) => item.value !== null);
    }

    const monthMap = {};
    validRecords.forEach((record) => {
      const month = record.date.slice(0, 7);
      monthMap[month] = record;
    });

    return Object.keys(monthMap).sort().map((month) => ({
      label: this.data.scope === 'year' ? dayjs(`${month}-01`).format('MM月') : dayjs(`${month}-01`).format('YY/MM'),
      value: toNumber(monthMap[month].weight)
    })).filter((item) => item.value !== null);
  },

  initTrendChart(records) {
    const points = this.buildTrendPoints(records);
    if (points.length < 2) return;

    wx.nextTick(() => {
      this.ecComponent = this.selectComponent('#records-chart');
      if (!this.ecComponent) return;
      const aimWeight = toNumber(App.globalData.userInfo && App.globalData.userInfo.aimWeight);
      const weightData = points.map((item) => item.value);
      const axisValues = aimWeight ? weightData.concat([aimWeight]) : weightData;
      const series = [{
        name: '体重',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.12 },
        data: weightData
      }];
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

      this.ecComponent.init((canvas, width, height, dpr) => {
        if (!canvas || !width || !height) return null;
        const chart = echarts.init(canvas, null, {
          width,
          height,
          devicePixelRatio: dpr || 1
        });
        chart.setOption({
          color: ['#188be4'],
          grid: { left: 34, right: 42, top: 36, bottom: 32 },
          legend: aimWeight ? { data: ['体重', '目标体重'], top: 4, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11 } } : undefined,
          tooltip: { trigger: 'axis' },
          xAxis: {
            type: 'category',
            data: points.map((item) => item.label),
            boundaryGap: false,
            axisLabel: { fontSize: 10, hideOverlap: true }
          },
          yAxis: {
            type: 'value',
            scale: true,
            min: this.getAxisMin(axisValues),
            max: this.getAxisMax(axisValues),
            axisLabel: { fontSize: 10 }
          },
          series
        });
        this.chart = chart;
        return chart;
      });
    });
  },

  getAxisMin(values) {
    const nums = values.filter((item) => item !== null && Number.isFinite(item));
    if (!nums.length) return undefined;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min;
    const padding = Math.max(4, range * 0.12);
    return Math.floor(min - padding);
  },

  getAxisMax(values) {
    const nums = values.filter((item) => item !== null && Number.isFinite(item));
    if (!nums.length) return undefined;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min;
    const padding = Math.max(4, range * 0.12);
    return Math.ceil(max + padding);
  },

  getTrendSubtitle() {
    if (this.data.scope === 'month') {
      return '按每日记录展示体重变化';
    }
    if (this.data.chartGranularity === 'day') {
      return this.data.scope === 'year' ? '按每日记录展示今年体重变化' : '按每日记录展示历史体重变化';
    }
    return this.data.scope === 'year' ? '按月份展示今年体重变化' : '按月份展示历史体重变化';
  },

  buildArchiveGroups(records) {
    const monthMap = {};
    records.forEach((record) => {
      const month = record.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = [];
      monthMap[month].push(record);
    });

    const months = Object.keys(monthMap).sort((a, b) => b.localeCompare(a)).map((month) => {
      const monthRecords = monthMap[month].sort((a, b) => a.date.localeCompare(b.date));
      const weights = monthRecords.map((item) => toNumber(item.weight)).filter((item) => item !== null);
      const first = weights[0];
      const latest = weights[weights.length - 1];
      const diff = latest - first;
      return {
        month,
        year: month.slice(0, 4),
        label: dayjs(`${month}-01`).format('MM月'),
        days: monthRecords.length,
        latestWeight: `${formatWeight(latest)}斤`,
        changeText: monthRecords.length > 1 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}斤` : '暂无变化',
        changeClass: diff > 0 ? 'up' : diff < 0 ? 'down' : ''
      };
    });

    if (this.data.scope === 'year') {
      return [{ year: this.data.currentYear, months }];
    }

    const yearMap = {};
    months.forEach((item) => {
      if (!yearMap[item.year]) yearMap[item.year] = [];
      yearMap[item.year].push(item);
    });
    return Object.keys(yearMap)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({ year, months: yearMap[year] }));
  },

  buildSummary(records) {
    if (!records.length) {
      return {
        days: 0,
        latestWeight: '--',
        minWeight: '--',
        maxWeight: '--',
        changeText: '--',
        changeClass: '',
        noteText: '记录两次后显示变化',
        statusText: '先记录，再观察'
      };
    }

    const weights = records.map((item) => toNumber(item.weight)).filter((item) => item !== null);
    const first = weights[0];
    const latest = weights[weights.length - 1];
    const diff = latest - first;
    const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
    let statusText = '保持观察';
    if (diff < 0) statusText = '趋势不错';
    if (diff > 0) statusText = '注意波动';

    return {
      days: records.length,
      latestWeight: `${formatWeight(latest)}斤`,
      minWeight: `${formatWeight(Math.min(...weights))}斤`,
      maxWeight: `${formatWeight(Math.max(...weights))}斤`,
      changeText: records.length > 1 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}斤` : '暂无变化',
      changeClass,
      noteText: records.length > 1 ? '较当前范围首次记录' : '记录两次后显示趋势',
      statusText
    };
  },

  shiftMonth(offset) {
    if (this.data.scope === 'all') return;
    if (this.data.scope === 'year') {
      const currentYear = String(Number(this.data.currentYear) + offset);
      this.setData({
        currentYear,
        periodTitle: getYearLabel(currentYear)
      }, () => this.applyArchiveRecords());
      return;
    }
    const date = dayjs(`${this.data.currentMonth}-01`).toDate();
    date.setMonth(date.getMonth() + offset);
    const currentMonth = formatMonth(date);
    this.setData({
      currentMonth,
      currentYear: currentMonth.slice(0, 4),
      monthLabel: getMonthLabel(currentMonth),
      periodTitle: getMonthLabel(currentMonth)
    }, () => this.loadMonthRecords());
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
    this.setData({
      scope,
      chartGranularity: 'day'
    }, () => this.loadRecords());
  },

  changeGranularity(e) {
    const chartGranularity = e.currentTarget.dataset.granularity;
    if (chartGranularity === this.data.chartGranularity) return;
    this.setData({
      chartGranularity
    }, () => {
      this.setData({
        trendSubtitle: this.getTrendSubtitle(),
        hasTrendData: this.buildTrendPoints(this.data.records).length >= 2
      }, () => this.initTrendChart(this.data.records));
    });
  },

  openMonth(e) {
    const currentMonth = e.currentTarget.dataset.month;
    this.setData({
      scope: 'month',
      currentMonth,
      currentYear: currentMonth.slice(0, 4),
      monthLabel: getMonthLabel(currentMonth)
    }, () => this.loadMonthRecords());
  },

  openEdit(e) {
    const record = this.data.displayRecords[e.currentTarget.dataset.index];
    this.setData({
      showEditDialog: true,
      editingRecord: record,
      editWeight: record.weight
    });
  },

  closeEdit() {
    this.setData({
      showEditDialog: false,
      editingRecord: {},
      editWeight: ''
    });
  },

  onEditWeightInput(e) {
    this.setData({ editWeight: e.detail.value });
  },

  submitEdit() {
    const weight = toNumber(this.data.editWeight);
    const record = this.data.editingRecord;
    if (!weight || weight <= 0 || !record.date) {
      wx.showToast({ title: '请输入有效体重', icon: 'none' });
      return;
    }

    CF.update('records', { openId: true, date: record.date }, {
      date: record.date,
      weight,
      weightKg: Number((weight / 2).toFixed(2))
    }).then(() => {
      this.closeEdit();
      this.loadRecords();
      wx.showToast({ title: '已保存', icon: 'success' });
    });
  },

  confirmDelete(e) {
    const record = this.data.displayRecords[e.currentTarget.dataset.index];
    wx.showModal({
      title: '删除记录',
      content: `确定删除 ${record.date} 的体重记录吗？`,
      confirmColor: '#ff6470',
      success: (res) => {
        if (!res.confirm) return;
        CF.delete('records', { openId: true, date: record.date }).then(() => {
          this.loadRecords();
          wx.showToast({ title: '已删除', icon: 'success' });
        });
      }
    });
  }
});
