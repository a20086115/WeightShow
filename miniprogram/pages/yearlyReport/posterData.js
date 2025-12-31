// 年度报告海报数据模板
export default {
  width: 375,
  height: 555,
  views: [
    {
      type: 'image',
      url: '/components/canvasdrawer/poster_bg.png',
      top: 0,
      left: 0,
      width: 375,
      height: 555
    },
    {
      type: 'text',
      content: '您的好友【青山不老为雪白头】',
      fontSize: 16,
      color: '#402D16',
      textAlign: 'left',
      top: 33,
      left: 33,
      bolder: true
    },
    {
      type: 'text',
      content: '在【2025年】期间体重减少X.XXKG！',
      fontSize: 15,
      color: '#563D20',
      textAlign: 'left',
      top: 59.5,
      left: 33
    },
    {
      type: 'image',
      url: '',
      top: 136,
      left: 42.5,
      width: 290,
      height: 290
    },
    {
      type: 'image',
      url: '/components/canvasdrawer/qrcode.jpg',
      top: 430,
      left: 75,
      width: 78,
      height: 78
    },
    {
      type: 'text',
      content: '长按识别图中二维码来和我一起打卡呗~',
      fontSize: 14,
      color: '#383549',
      textAlign: 'left',
      top: 450,
      left: 165.5,
      lineHeight: 20,
      MaxLineNumber: 2,
      breakWord: true,
      width: 125
    }
  ]
}

