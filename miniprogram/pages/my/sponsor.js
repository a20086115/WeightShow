// pages/my/sponsor.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'

Page({

    /**
     * 页面的初始数据
     */
    data: {
        sponsorCount: 0,
        adLoading: false,
        rewardCode: 'cloud://release-ba24f3.7265-release-ba24f3-1257780911/notice/赞赏码.jpeg', // 替换成你的赞赏码图片云存储地址
        adUnitId: 'adunit-1f4099122b9a1d21', // 替换成你的广告单元ID
        showAd: false, // 是否显示广告
        showSponsor: false // 是否显示赞赏码
    },
    

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        this.loadSponsorCount()
        this.checkSponsorStatus()
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

    // 加载总赞助次数
    loadSponsorCount() {
        // 获取所有赞助记录数量
        CF.count("sponsor", {}).then((res) => {
            if(res.result && res.result.total) {
                this.setData({
                    sponsorCount: res.result.total
                })
            }
        })
    },

    // 显示激励广告
    showRewardedAd() {
        this.setData({ adLoading: true })
        
        // 创建广告实例
        const videoAd = wx.createRewardedVideoAd({
            adUnitId: this.data.adUnitId
        })

        // 清除可能存在的旧事件监听
        videoAd.offClose()
        videoAd.offError()

        // 绑定新的事件监听
        videoAd.onClose(res => {
            this.setData({ adLoading: false })
            if (res && res.isEnded) {
                this.updateSponsorCount()
            }
        })

        videoAd.onError(() => {
            this.setData({ adLoading: false })
            wx.showToast({
                title: '广告加载失败',
                icon: 'none'
            })
        })

        // 加载并显示广告
        videoAd.load()
            .then(() => videoAd.show())
            .catch(() => {
                this.setData({ adLoading: false })
                wx.showToast({
                    title: '广告加载失败',
                    icon: 'none'
                })
            })
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
    },

    // 更新赞助记录
    updateSponsorCount() {
        // 新增一条赞助记录
        CF.insert("sponsor", {
            openId: true,
            updateTime: new Date()
        }).then(() => {
            // 重新获取总数
            this.loadSponsorCount()
            wx.showModal({
                title: '奖励提示',
                content: '感谢您的观看，积分+1，系统已登记，请联系客服获取资料！',
                showCancel: false,
                confirmText: '确定'
            })
        })
    },

    // 检查赞赏码显示状态
    checkSponsorStatus() {
        CF.get("params", {
            code: "sponsor"
        }).then(res => {
            if(res.result && res.result.data && res.result.data.length > 0) {
                this.setData({
                    showSponsor: res.result.data[0].value === "1"
                })
            }
        })

        CF.get("params", {
            code: "ad"
        }).then(res => {
            if(res.result && res.result.data && res.result.data.length > 0) {
                this.setData({
                    showAd: res.result.data[0].value === "1"
                })
            }
        })
    }
})