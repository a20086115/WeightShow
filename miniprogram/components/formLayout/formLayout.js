import { cloud as CF } from '../../utils/cloudFunction.js'
Component({
  data: {
    formids: []
  },
  lifetimes: {
    attached: function () {
      // 在组件实例进入页面节点树时执行
      // 获取一下formid数量
      console.log(CF)
      CF.get("formids",{
        openId: true
      }, (res) =>{
        console.log(res)
        this.data.formids = res.result.data
      })
    },
    detached: function () {
      // 在组件实例被从页面节点树移除时执行
    },
  },
  methods: {
    formSubmit: function (e) {
      if(this.data.formids.length > 6){
        return;
      }else{
        let formId = e.detail.formId
        CF.insert("formids", {
          formid: formId
        }, (res) => {
          this.data.formids.push(formId)
        }, null, true)
      }

    }
  }
})