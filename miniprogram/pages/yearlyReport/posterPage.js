import dayjs from '../../utils/dayjs.min.js';
import { cloud as CF } from '../../utils/cloudFunction.js';

const App = getApp();

Page({
  data: {
    year: '2025',
    stats: null,
    loading: true,
    posterImagePath: '', // 生成的海报图片路径（云存储临时链接）
    posterFileID: '', // 云存储文件ID
    showSaveDialog: false,
    encouragementText: '', // 鼓励话语
    isDefaultNickname: false, // 是否为默认昵称
    showEditNicknameDialog: false, // 显示修改昵称弹窗
    editNickname: '' // 编辑中的昵称
  },

  onLoad: function(options) {
    this.setData({
      year: options.year || '2025',
      openId: options.openId || null // 支持查看他人报告
    });
    this.loadReportData();
  },

  /**
   * 判断是否为默认昵称
   */
  isDefaultNickname: function(nickName) {
    if (!nickName) return true;
    const defaultNames = ['用户', '微信用户', '微信用户(默认昵称)', '未授权', '未登录'];
    return defaultNames.some(name => nickName.includes(name) || nickName === name);
  },
  
  /**
   * 编辑昵称
   */
  editNickname: function() {
    this.setData({
      showEditNicknameDialog: true
    });
  },
  
  /**
   * 关闭编辑昵称弹窗
   */
  closeEditNicknameDialog: function() {
    this.setData({
      showEditNicknameDialog: false
    });
  },
  
  /**
   * 昵称输入变化
   */
  onNicknameChange: function(e) {
    this.setData({
      editNickname: e.detail
    });
  },
  
  /**
   * 保存昵称
   */
  saveNickname: function() {
    const nickName = this.data.editNickname.trim();
    if (!nickName) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }
    
    if (nickName.length > 20) {
      wx.showToast({
        title: '昵称不能超过20个字符',
        icon: 'none'
      });
      return;
    }
    
    // 保存到数据库
    CF.update("users", {
      openId: true
    }, {
      nickName: nickName
    }, (res) => {
      // 更新全局用户信息
      if (App.globalData.userInfo) {
        App.globalData.userInfo.nickName = nickName;
      }
      // 更新本地数据
      if (this.data.stats && this.data.stats.userInfo) {
        this.data.stats.userInfo.nickName = nickName;
      }
      
      this.setData({
        'stats.userInfo.nickName': nickName,
        isDefaultNickname: this.isDefaultNickname(nickName),
        showEditNicknameDialog: false
      });
      
      // 重新生成海报
      setTimeout(() => {
        this.generatePoster();
      }, 300);
      
      wx.showToast({
        title: '修改成功',
        icon: 'success',
        duration: 1500
      });
    }, (err) => {
      console.error('保存昵称失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    });
  },
  
  /**
   * 生成鼓励话语
   */
  getEncouragement: function(stats) {
    if (!stats) return '';
    
    let text = '';
    if (stats.weightChange !== null && stats.weightChange < 0) {
      const absChange = Math.abs(stats.weightChange);
      if (absChange >= 10) {
        text = `这一年，你用${stats.totalDays}天坚持，成功减重${absChange}斤！太厉害了！`;
      } else if (absChange >= 5) {
        text = `这一年，你用${stats.totalDays}天坚持，悄悄瘦了${absChange}斤～继续加油！`;
      } else {
        text = `这一年，你用${stats.totalDays}天坚持，减重${absChange}斤！每一步都算数！`;
      }
    } else if (stats.totalDays > 0) {
      if (stats.maxConsecutiveDays >= 30) {
        text = `这一年，你坚持打卡${stats.totalDays}天，最长连续${stats.maxConsecutiveDays}天！自律的你最棒！`;
      } else {
        text = `这一年，你坚持打卡${stats.totalDays}天！坚持就是胜利！`;
      }
    } else {
      text = `这一年，你开始记录体重变化！好的开始是成功的一半！`;
    }
    
    return text;
  },

  /**
   * 加载报告数据
   */
  loadReportData: function() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'getYearlyReport',
      data: {
        year: this.data.year
      }
    }).then((res) => {
      wx.hideLoading();
      if (res.result.errCode) {
        wx.showToast({
          title: res.result.errMsg || '加载失败',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      const { stats } = res.result;
      
      // 如果云函数没有返回昵称，尝试从全局数据获取
      if (!stats.userInfo || !stats.userInfo.nickName || stats.userInfo.nickName === '用户') {
        const globalUserInfo = App.globalData.userInfo;
        if (globalUserInfo && globalUserInfo.nickName) {
          if (!stats.userInfo) {
            stats.userInfo = {};
          }
          stats.userInfo.nickName = globalUserInfo.nickName;
        }
      }

      // 判断是否为默认昵称
      const nickName = stats.userInfo && stats.userInfo.nickName ? stats.userInfo.nickName : '用户';
      const isDefaultNickname = this.isDefaultNickname(nickName);

      // 生成鼓励话语
      const encouragementText = this.getEncouragement(stats);

      this.setData({
        stats: stats,
        loading: false,
        encouragementText: encouragementText,
        isDefaultNickname: isDefaultNickname,
        editNickname: nickName
      });

      // 延迟生成海报，确保页面渲染完成
      setTimeout(() => {
        this.generatePoster();
      }, 800);
    }).catch((err) => {
      wx.hideLoading();
      console.error('加载年度报告失败:', err);
      wx.showToast({
        title: '网络出小差了,请稍后再试...',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 生成海报
   */
  generatePoster: function() {
    const stats = this.data.stats;
    if (!stats) {
      return;
    }

    wx.showLoading({
      title: '生成海报中...',
      mask: true
    });

    // 固定海报尺寸（750x1334，适配手机屏幕比例）
    const canvasWidth = 750;
    const canvasHeight = 1334;
    
    // 使用 canvas 生成海报
    const ctx = wx.createCanvasContext('poster-canvas', this);
    
    // 绘制背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 绘制白色内容区域
    const padding = 30;
    const contentWidth = canvasWidth - padding * 2;
    const contentHeight = canvasHeight - padding * 2;
    
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(padding, padding, contentWidth, contentHeight);

    // 绘制装饰性顶部区域（渐变背景）
    const headerHeight = 200;
    const headerGradient = ctx.createLinearGradient(0, padding, 0, padding + headerHeight);
    headerGradient.addColorStop(0, '#667eea');
    headerGradient.addColorStop(1, '#764ba2');
    ctx.setFillStyle(headerGradient);
    ctx.fillRect(padding, padding, contentWidth, headerHeight);

    // 绘制标题（白色文字）
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(48);
    ctx.setTextAlign('center');
    ctx.fillText(`${this.data.year}年度报告`, canvasWidth / 2, padding + 80);

    // 绘制用户昵称（白色文字）
    const nickName = stats.userInfo && stats.userInfo.nickName ? stats.userInfo.nickName : '用户';
    ctx.setFontSize(32);
    ctx.setFillStyle('#ffffff');
    ctx.fillText(`@${nickName}`, canvasWidth / 2, padding + 130);
    
    // 绘制个性标签（在昵称下方）
    let tagYPos = padding + 180;
    if (stats.personalityTags && stats.personalityTags.length > 0) {
      ctx.setFontSize(20);
      ctx.setFillStyle('#ffffff');
      ctx.setTextAlign('center');
      
      const tagPadding = 10;
      const tagHeight = 35;
      const tagSpacing = 10;
      const totalTagWidth = stats.personalityTags.reduce((sum, tag) => {
        return sum + ctx.measureText(tag).width + tagPadding * 2 + tagSpacing;
      }, 0) - tagSpacing; // 最后一个标签不需要间距
      
      let currentX = canvasWidth / 2 - totalTagWidth / 2; // 居中开始
      
      stats.personalityTags.forEach((tag) => {
        const tagWidth = ctx.measureText(tag).width + tagPadding * 2;
        
        // 绘制标签背景（半透明白色）
        ctx.setFillStyle('rgba(255, 255, 255, 0.3)');
        ctx.fillRect(currentX, tagYPos - tagHeight / 2, tagWidth, tagHeight);
        
        // 绘制标签文字
        ctx.setFontSize(20);
        ctx.setFillStyle('#ffffff');
        ctx.fillText(tag, currentX + tagPadding, tagYPos);
        
        currentX += tagWidth + tagSpacing;
      });
    }

    let yPos = padding + headerHeight + 50;
    const lineHeight = 50;
    ctx.setFontSize(28);
    ctx.setTextAlign('left');
    const leftPadding = padding + 40;

    // 绘制核心数据卡片（横排）
    ctx.setFillStyle('#f5f7fa');
    ctx.fillRect(leftPadding - 20, yPos - 20, contentWidth - 40, 120);
    
    const statItemWidth = (contentWidth - 40) / 2;
    const statCenterX1 = leftPadding + statItemWidth / 2;
    const statCenterX2 = leftPadding + statItemWidth + statItemWidth / 2;
    
    // 打卡天数
    ctx.setFontSize(40);
    ctx.setFillStyle('#333333');
    ctx.setTextAlign('center');
    ctx.fillText(`${stats.totalDays}`, statCenterX1, yPos + 20);
    ctx.setFontSize(24);
    ctx.setFillStyle('#667eea');
    ctx.fillText('打卡天数', statCenterX1, yPos + 50);
    
    // 连续打卡
    if (stats.maxConsecutiveDays > 0) {
      ctx.setFontSize(40);
      ctx.setFillStyle('#333333');
      ctx.fillText(`${stats.maxConsecutiveDays}`, statCenterX2, yPos + 20);
      ctx.setFontSize(24);
      ctx.setFillStyle('#667eea');
      ctx.fillText('连续打卡', statCenterX2, yPos + 50);
    }
    
    yPos += 100;

    // 绘制体重变化卡片（优化布局）
    if (stats.startWeight && stats.endWeight) {
      yPos += 60;
      ctx.setFillStyle('#f5f7fa');
      ctx.fillRect(leftPadding - 20, yPos - 20, contentWidth - 40, 180);
      
      ctx.setFontSize(28);
      ctx.setFillStyle('#999999');
      ctx.setTextAlign('center');
      ctx.fillText('体重变化', canvasWidth / 2, yPos + 10);
      yPos += 50;
      
      // 年初体重（左侧）
      const weightItemWidth = (contentWidth - 40) / 3;
      const weightX1 = leftPadding + weightItemWidth / 2;
      const weightX2 = leftPadding + weightItemWidth + weightItemWidth / 2;
      const weightX3 = leftPadding + weightItemWidth * 2 + weightItemWidth / 2;
      
      ctx.setFontSize(24);
      ctx.setFillStyle('#666666');
      ctx.fillText('年初', weightX1, yPos);
      ctx.setFontSize(36);
      ctx.setFillStyle('#333333');
      ctx.fillText(`${stats.startWeight}`, weightX1, yPos + 35);
      ctx.setFontSize(20);
      ctx.fillText('斤', weightX1, yPos + 55);
      
      // 箭头
      ctx.setFontSize(32);
      ctx.setFillStyle('#667eea');
      ctx.fillText('→', weightX2, yPos + 25);
      
      // 年末体重（右侧）
      ctx.setFontSize(24);
      ctx.setFillStyle('#666666');
      ctx.fillText('年末', weightX3, yPos);
      const changeColor = stats.weightChange < 0 ? '#34C759' : stats.weightChange > 0 ? '#FF3B30' : '#333333';
      ctx.setFontSize(36);
      ctx.setFillStyle(changeColor);
      ctx.fillText(`${stats.endWeight}`, weightX3, yPos + 35);
      ctx.setFontSize(20);
      ctx.fillText('斤', weightX3, yPos + 55);
      
      yPos += 60;
    }

    // 绘制鼓励话语
    if (this.data.encouragementText) {
      yPos += 40;
      ctx.setFillStyle('#ffeaa7');
      ctx.fillRect(leftPadding - 20, yPos - 20, contentWidth - 40, 100);
      
      ctx.setFontSize(28);
      ctx.setFillStyle('#333333');
      // 文字换行处理
      const maxWidth = contentWidth - 80;
      const text = this.data.encouragementText;
      const lines = [];
      let currentLine = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      
      lines.forEach((line, index) => {
        ctx.fillText(line, leftPadding, yPos + index * 35);
      });
      yPos += lines.length * 35 + 20;
    }

    ctx.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: 'poster-canvas',
          success: (res) => {
            // 上传到云存储，以便分享时使用
            const openId = App.globalData.userInfo && App.globalData.userInfo.openId 
              ? App.globalData.userInfo.openId 
              : 'default';
            const cloudPath = `posters/${openId}/${this.data.year}_${Date.now()}.png`;
            
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: res.tempFilePath,
              success: (uploadRes) => {
                // 获取云存储文件的临时链接
                wx.cloud.getTempFileURL({
                  fileList: [uploadRes.fileID],
                  success: (urlRes) => {
                    wx.hideLoading();
                    const imageUrl = urlRes.fileList[0].tempFileURL;
                    this.setData({
                      posterImagePath: imageUrl, // 使用云存储的临时链接
                      posterFileID: uploadRes.fileID // 保存fileID用于其他用途
                    });
                    wx.showToast({
                      title: '海报生成成功',
                      icon: 'success',
                      duration: 1500
                    });
                  },
                  fail: (urlErr) => {
                    console.error('获取临时链接失败:', urlErr);
                    // 如果获取临时链接失败，使用本地路径（可能分享不生效）
                    wx.hideLoading();
                    this.setData({
                      posterImagePath: res.tempFilePath
                    });
                    wx.showToast({
                      title: '海报生成成功',
                      icon: 'success',
                      duration: 1500
                    });
                  }
                });
              },
              fail: (uploadErr) => {
                console.error('上传海报失败:', uploadErr);
                // 如果上传失败，使用本地路径（可能分享不生效）
                wx.hideLoading();
                this.setData({
                  posterImagePath: res.tempFilePath
                });
                wx.showToast({
                  title: '海报生成成功（分享可能受限）',
                  icon: 'success',
                  duration: 1500
                });
              }
            });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('生成海报失败:', err);
            wx.showToast({
              title: '生成失败，请重试',
              icon: 'none'
            });
          }
        }, this);
      }, 800);
    });
  },

  /**
   * 保存海报到相册
   */
  savePoster: function() {
    if (!this.data.posterImagePath && !this.data.posterFileID) {
      wx.showToast({
        title: '海报未生成',
        icon: 'none'
      });
      return;
    }

    // 如果是网络路径，需要先下载
    const imagePath = this.data.posterImagePath;
    if (imagePath && imagePath.startsWith('http')) {
      wx.showLoading({
        title: '下载中...',
        mask: true
      });
      wx.downloadFile({
        url: imagePath,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            this.saveImageToAlbum(res.tempFilePath);
          } else {
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      });
      return;
    }
    
    // 本地路径直接保存
    this.saveImageToAlbum(imagePath);
  },
  
  /**
   * 保存图片到相册
   */
  saveImageToAlbum: function(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要授权保存图片到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 分享到朋友圈（按钮点击）
   */
  shareToTimeline: function() {
    // 微信小程序分享到朋友圈需要通过右上角菜单触发
    // 引导用户使用右上角菜单分享
    wx.showModal({
      title: '分享到朋友圈',
      content: '请点击右上角"..."菜单，选择"分享到朋友圈"',
      showCancel: false,
      confirmText: '知道了'
    });
  },
  
  /**
   * 显示分享给好友提示
   */
  showShareTip: function() {
    wx.showToast({
      title: '✨点击右上角"..."分享给好友吧～',
      icon: 'none',
      duration: 2500
    });
  },

  /**
   * 分享到朋友圈（页面配置）
   */
  onShareTimeline: function() {
    const stats = this.data.stats;
    let title = `我的${this.data.year}年瘦身打卡报告`;
    
    if (stats && stats.weightChange !== null && stats.weightChange < 0) {
      title = `我今年瘦了${Math.abs(stats.weightChange)}斤～`;
    }
    
    return {
      title: title,
      imageUrl: this.data.posterImagePath || '' // 分享的海报图片
    };
  },

  /**
   * 分享给朋友
   */
  onShareAppMessage: function() {
    const stats = this.data.stats;
    let title = `我的${this.data.year}年瘦身打卡报告`;
    
    if (stats && stats.weightChange !== null && stats.weightChange < 0) {
      title = `✨我今年瘦了${Math.abs(stats.weightChange)}斤！快来一起打卡吧💪`;
    } else {
      title = `✨我的${this.data.year}年瘦身打卡报告出炉啦～快来一起打卡吧💪`;
    }
    
    // 如果当前用户有openId，分享时带上openId参数，让好友可以查看
    const openId = App.globalData.userInfo && App.globalData.userInfo.openId ? App.globalData.userInfo.openId : '';
    let path = `/pages/yearlyReport/yearlyReport?year=${this.data.year}`;
    if (openId) {
      path += `&openId=${openId}`;
    }
    
    return {
      title: title,
      path: path,
      imageUrl: this.data.posterImagePath || ''
    };
  }
});

