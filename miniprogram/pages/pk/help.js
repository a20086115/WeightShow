var help = (function(){
  var obj = {
     setOption(chart) {
      var option = {
        title: {
          text: '数据曲线',
          left: 'center',
          z: 1,
          show: true
        },
        color: ["#37A2DA"],
        legend: {
          data: ['本月体重曲线'],
          top: 0,
          left: 'center',
          show: false,
        },
        grid: {
          containLabel: true
        },
        tooltip: {
          show: true,
          // confine:true,
          trigger: 'axis',
          formatter: '{b0}: {c0}',
          position: function (pos, params, dom, rect, size) {
            // 鼠标在左侧时 tooltip 显示到右侧，鼠标在右侧时 tooltip 显示到左侧。
            if (pos[0] < size.viewSize[0] / 2) {
              return { top: pos[1], left: pos[0] + 5 }
            } else {
              return { top: pos[1], right: size.viewSize[0] - pos[0] - 5 }
            }

          }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: xData
          // data: ["2019-09-04", "2019-09-05", "2019-09-06", "2019-09-07", "2019-09-08"],
          // show: false
        },
        yAxis: {
          x: 'center',
          type: 'value',
          splitLine: {
            lineStyle: {
              type: 'dashed'
            }
          },
          min: function (value) {
            return parseInt(value.min - 4);
          }
          // show: false
        },
        series: [{
          name: '本月体重曲线',
          type: 'line',
          smooth: true,

          data: yData
          // data: ["81", "81", "81", "81", "81"]
        }]
      };

  chart.setOption(option);
}
  };
  
  return obj;
}())
export {help}