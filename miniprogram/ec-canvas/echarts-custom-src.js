/**
 * ECharts 5.6 极简按需引入 - 仅折线图 + 必要组件
 */
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer
]);

export const init = echarts.init;
export const setCanvasCreator = echarts.setCanvasCreator;
export const graphic = echarts.graphic;
export default echarts;
