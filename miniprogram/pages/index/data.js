export default {
    width: 375,
    height: 555,
    views: [
      {
        type: 'image',
        url: 'poster_bg.png',
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
        content: '在【2019-08】期间体重狂减2.5Kg！',
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
      // {
      //   type: 'text',
      //   content: '看看他的体重曲线趋势图',
      //   fontSize: 16,
      //   lineHeight: 21,
      //   color: '#383549',
      //   textAlign: 'left',
      //   top: 336,
      //   left: 44,
      //   width: 287,
      //   MaxLineNumber: 2,
      //   breakWord: true,
      //   bolder: true
      // },
      // {
      //   type: 'text',
      //   content: '￥0.00',
      //   fontSize: 19,
      //   color: '#E62004',
      //   textAlign: 'left',
      //   top: 387,
      //   left: 44.5,
      //   bolder: true
      // },
      // {
      //   type: 'text',
      //   content: '原价:￥138.00',
      //   fontSize: 13,
      //   color: '#7E7E8B',
      //   textAlign: 'left',
      //   top: 391,
      //   left: 110,
      //   textDecoration: 'line-through'
      // },
      {
        type: 'image',
        url: 'qrcode.jpg',
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