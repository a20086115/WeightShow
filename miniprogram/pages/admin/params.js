function getValueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function stringifyValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function parseValue(raw, type) {
  const text = raw || '';
  if (type === 'boolean') {
    return text === 'true' || text === '1' || text === '是' || text === '开启';
  }
  if (type === 'number') {
    const num = Number(text);
    if (!Number.isFinite(num)) throw new Error('请输入数字');
    return num;
  }
  if (type === 'object' || type === 'array' || type === 'null') {
    return text ? JSON.parse(text) : null;
  }
  return text;
}

function normalizeParam(item = {}) {
  const type = getValueType(item.value);
  return {
    ...item,
    valueType: type,
    valueText: stringifyValue(item.value),
    updatedText: item.updatedAt || item.updatedate || item.createdAt || item.createdate || ''
  };
}

Page({
  data: {
    params: [],
    page: 1,
    hasMore: false,
    loading: false,
    visibleEdit: false,
    editingIndex: -1,
    editingParam: {},
    editValue: ''
  },

  onLoad() {
    this.loadParams(true);
  },

  onPullDownRefresh() {
    this.loadParams(true).finally(() => wx.stopPullDownRefresh());
  },

  loadParams(reset = false) {
    if (this.data.loading) return Promise.resolve();
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    return wx.cloud.callFunction({
      name: 'adminListParams',
      data: { page, size: 50 }
    }).then((res) => {
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({ title: result.errMsg || '加载失败', icon: 'none' });
        return;
      }
      const list = (result.data || []).map(normalizeParam);
      this.setData({
        params: reset ? list : this.data.params.concat(list),
        page,
        hasMore: !!result.hasMore
      });
    }).catch(() => {
      wx.showToast({ title: '参数加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  loadMore() {
    if (!this.data.hasMore) return;
    this.loadParams(false);
  },

  openEdit(e) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.params[index];
    if (!item) return;
    this.setData({
      visibleEdit: true,
      editingIndex: index,
      editingParam: item,
      editValue: item.valueText
    });
  },

  closeEdit() {
    this.setData({
      visibleEdit: false,
      editingIndex: -1,
      editingParam: {},
      editValue: ''
    });
  },

  onEditValueInput(e) {
    this.setData({ editValue: e.detail.value || '' });
  },

  saveParam() {
    const item = this.data.editingParam;
    if (!item.code) return;

    let value;
    try {
      value = parseValue(this.data.editValue, item.valueType);
    } catch (err) {
      wx.showToast({ title: err.message || '参数格式错误', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中', mask: true });
    wx.cloud.callFunction({
      name: 'adminUpdateParam',
      data: {
        code: item.code,
        value
      }
    }).then((res) => {
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({ title: result.errMsg || '保存失败', icon: 'none' });
        return;
      }
      const next = normalizeParam({
        ...item,
        value,
        updatedAt: result.data && result.data.updatedAt ? result.data.updatedAt : item.updatedAt
      });
      this.setData({
        [`params[${this.data.editingIndex}]`]: next
      });
      this.closeEdit();
      wx.showToast({ title: '已保存', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }).finally(() => {
      wx.hideLoading();
    });
  }
});
