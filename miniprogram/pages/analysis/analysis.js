function pad(num) {
  return String(num).padStart(2, '0');
}

function formatMonth(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

Page({
  onLoad(options) {
    const currentMonth = options.month || formatMonth(new Date());
    wx.redirectTo({
      url: `/pages/recordsV2/records?month=${currentMonth}`
    });
  }
});
