// pages/my/sponsor.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'

Page({

    /**
     * 页面的初始数据
     */
    data: {
        rewardCode: 'cloud://release-ba24f3.7265-release-ba24f3-1257780911/notice/赞赏码.jpeg',
        blessing: '',
        blessings: [
            '管住嘴迈开腿，你已经在路上了！💪',
            '瘦下来的你，一定会感谢现在努力的自己~',
            '每天轻一点，离目标就近一步！',
            '坚持记录，就是成功的一半 ✨',
            '你不是一个人在战斗，我们一起加油！',
            '今天的汗水，是明天的自信 🏃',
            '体重只是数字，健康才是目的~',
            '别急，好身材正在来的路上 🌟',
            '每一次打卡，都是对自己的承诺！',
            '减肥不是受苦，是遇见更好的自己 ❤️'
        ]
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        this.randomBlessing();
    },

    randomBlessing() {
        const list = this.data.blessings;
        const idx = Math.floor(Math.random() * list.length);
        this.setData({ blessing: list[idx] });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {
        return {
            title: '感谢您的支持，一起来为开发者加油吧！',
            path: '/pages/my/sponsor',
            imageUrl: '/images/share-sponsor.png' // 可选，自定义转发图片
        }
    },

    // 查看赞赏码
    showRewardCode() {
        wx.previewImage({
            urls: [this.data.rewardCode]
        })
    },

    // 处理客服消息
    handleContact(e) {
        console.log('联系客服', e)
    }
})