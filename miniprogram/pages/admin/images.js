Page({
  data: {
    images: [],
    page: 1,
    hasMore: false,
    loading: false,
    datePrefix: '',
    openId: '',
    total: 0
  },

  onLoad() {
    this.loadImages(true);
  },

  onPullDownRefresh() {
    this.loadImages(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadMore();
  },

  onDateInput(e) {
    this.setData({ datePrefix: e.detail.value || '' });
  },

  onOpenIdInput(e) {
    this.setData({ openId: e.detail.value || '' });
  },

  searchImages() {
    this.loadImages(true);
  },

  clearFilters() {
    this.setData({
      datePrefix: '',
      openId: ''
    }, () => this.loadImages(true));
  },

  loadImages(reset = false) {
    if (this.data.loading) return Promise.resolve();
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true });
    return wx.cloud.callFunction({
      name: 'adminListUploadedImages',
      data: {
        page,
        size: 50,
        datePrefix: this.data.datePrefix.trim(),
        openId: this.data.openId.trim()
      }
    }).then((res) => {
      const result = res.result || {};
      if (!result.ok) {
        wx.showToast({ title: result.errMsg || '加载失败', icon: 'none' });
        return;
      }
      const list = result.data || [];
      this.setData({
        images: reset ? list : this.data.images.concat(list),
        page,
        total: result.total || 0,
        hasMore: !!result.hasMore
      });
    }).catch(() => {
      wx.showToast({ title: '图片加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadImages(false);
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    if (!current) return;
    const urls = this.data.images.map((item) => item.previewUrl).filter(Boolean);
    wx.previewImage({ current, urls });
  }
});
