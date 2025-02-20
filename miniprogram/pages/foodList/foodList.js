// miniprogram/pages/food/foodList.js
import { cloud as CF } from '../../utils/cloudFunctionPromise.js'
import Toast from "../../miniprogram_npm/@vant/weapp/toast/toast";
Page({

  /**
   * 页面的初始数据
   */
  data: {
    FOOD_IMAGE_DEFAULT:"/images/default_image.png",
    currentDate: "",
    currentFoods: [], // 食品列表
    currentFood:{}, // 当前选中食品
    currentType: 0, // 当前早餐午餐晚餐 0-1-2
    currentCount:1, // 当前选中的份数
    search: "", // 搜索关键词
    properties:["早餐","午餐","晚餐"],
    show: false,
    visibleUserFoodDialog:false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.setData({
      search: options.key,
      currentType: options.type,
      currentDate: options.date
    })
    console.log(options)
    this.queryFoodList();
  },
  onChange(e) {
    this.setData({
      search: e.detail,
    });
  },
  onSearch() {
    this.queryFoodList();
  },
  queryFoodList(){
    console.log(this.data)
    if(this.data.search){
      CF.list("foods",{
          _id:{
            $regex:'.*'+ this.data.search,
            $options: 'i'
          }
        },1,100).then(res =>{
          this.setData({
            currentFoods: res.result.data
          })
        })
    }
  },
  clickFoods(e){
    this.setData({ 
      show: true ,
      currentFood: e.currentTarget.dataset.item,
      currentCount: 1
    });
  },
  onClose() {
    this.setData({ show: false });
  },
  selectType(e){
    this.setData({ 
      currentType: e.currentTarget.dataset.index
    });
  },
  addCount(){
    this.setData({ 
      currentCount: ++this.data.currentCount
    });
  },
  modCount(){
    if(this.data.currentCount < 2){
      return;
    }
    this.setData({ 
      currentCount: --this.data.currentCount
    });
  },
  onCountChange(e){
    this.setData({ 
      currentCount: e.detail.value
    });
  },
  addDayMeal(){
      CF.insert("meal",{
        date: this.data.currentDate,
        count: parseFloat(this.data.currentCount),
        name: this.data.currentFood._id,
        type: this.data.currentType,
        calorie: parseFloat(this.data.currentFood.calorie)
      }).then( res => {
        this.setData({ show: false });
        Toast.success('添加成功');
      })
  },
  // 用户自定义食物上传
  addUserFood(){
    this.setData({
      visibleUserFoodDialog:true
    })
  },
  handleInsertUserFood(e){
    this.setData({
      visibleUserFoodDialog: false
    })
    if (e.detail == "confirm") { // 点击确定
     
    }
  },
  uploadPhoto() {
    var that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success:res => {
        // wx.showLoading({
        //   title: '上传中',
        // })
        const filePath = res.tempFilePaths[0]
        that.setData({
          image: filePath
        })
        this.convertImageToBase64(filePath)
        return;
        // 上传图片
        const cloudPath = openId + "/" + that.data.currentdate + "_" + new Date().getTime() + filePath.match(/\.[^.]+?$/)[0]

        console.log(cloudPath)
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: res => {
            wx.hideLoading()
            console.log('[上传文件] 成功：', cloudPath, res)
            // 保存到记录中去
            that.saveImageId(that.data.currentdate, res.fileID)
          },
          fail: e => {
            wx.hideLoading()
            wx.showToast({
              icon: 'none',
              title: '上传失败',
            })
          }
        })
      },
      fail: e => {
        console.error(e)
      }
    })
  },
  // 转图片为BASE64
  convertImageToBase64(url){
    const FileSystemManager = wx.getFileSystemManager();
    FileSystemManager.readFile({
      filePath:url,
      encoding:"base64",
      success: res =>{
        this.setData({
          imageBase64: res.data
        })

        this.getBaiduFoodResult(res.data);
      }
    })
  },
  // 调用百度的图像识别接口
  async getBaiduFoodResult(imageBase64){
    if(!getApp().globalData.baiduAccessToken){
      let res = await CF.get("publicField",{_id:"baiduAccessToken"})
      getApp().globalData.baiduAccessToken = res.result.data[0].access_token;
      console.log("获取TOKEN", res)
    }

    wx.request({
      url: 'https://aip.baidubce.com/rest/2.0/image-classify/v2/dish?access_token=' + getApp().globalData.baiduAccessToken,
      method:"post",
      header:{
       "Content-Type":	"application/x-www-form-urlencoded"
      },
      data:{
        image: imageBase64,
        baike_num: 10,
        top_num: 10,
        filter_threshold:0.9
      },
      success:res=>{
        // 调用成功
        console.log(res)
        var result = res.data.result;
        var foods = [];
        if(result[0].name == "非菜"){
          // 没有搜索到数据
          Toast.fail('识别失败，建议重新尝试~')
        }else{
          for(var food of result){
            if(food.has_calorie){
              let obj = {};
              obj.calorie = food.calorie;
              obj._id = food.name;
              obj.img = food.baike_info ? food.baike_info.image_url : "";
              obj.desc = food.baike_info ? food.baike_info.description : ""
              foods.push(obj)
            }
          }
        }
        this.setData({
          currentFoods: foods
        })
        // 将数据悄悄统一存储
        this.saveFoodFromBaidu(foods);
      }
    })
  },
  saveFoodFromBaidu(foods){
    if(foods.length == 0) return;
    CF.ajax("insertBatch", {
      tbName: "foods",
      data: foods
    }, true).then(res =>{
      console.log(res, "insert食物数据成功")
    })
  },
  // 输入框
  onInputValueChange(e) {
    var value = e.detail;
    var id = e.target.id;
    var key = id;
    var obj = {};
    obj[key] = value;
    this.setData(obj)
  }
})