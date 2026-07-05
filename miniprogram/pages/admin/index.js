const ADMIN_OPEN_IDS = ['ohl0o47kLZ0eBSt7Osp1uGNJUfFM'];

function isAdminUser(userInfo = {}) {
  return !!(
    userInfo.isAdmin === true
    || userInfo.role === 'admin'
    || ADMIN_OPEN_IDS.includes(userInfo.openId)
  );
}

Page({
  data: {
    isAdmin: false
  },

  onLoad() {
    const app = getApp();
    if (app.ensureUserInfoWithId) {
      app.ensureUserInfoWithId().then(() => this.syncAdminState());
      return;
    }
    this.syncAdminState();
  },

  syncAdminState() {
    const userInfo = getApp().globalData.userInfo || {};
    const isAdmin = isAdminUser(userInfo);
    this.setData({ isAdmin });
    if (!isAdmin) {
      wx.showToast({ title: '无权限', icon: 'none' });
      wx.navigateBack();
    }
  },

  navToParams() {
    wx.navigateTo({ url: '/pages/admin/params' });
  },

  navToImages() {
    wx.navigateTo({ url: '/pages/admin/images' });
  }
});
