<!--
  BasePieChart - 环形图基础组件

  职责:
  - 提供环形图的统一样式
  - 支持中心文字显示
  - 支持点击事件
  - 支持数据更新动画
-->
<script setup lang="ts">
import { computed, ref as _ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getGradientColor } from '@/shared/lib/utils/colors'
import type { EChartsOption } from 'echarts'

use([PieChart, TooltipComponent, LegendComponent, GraphicComponent, CanvasRenderer])

/** 数据项接口 */
export interface PieDataItem {
  name: string
  value: number
  color?: string
  itemStyle?: Record<string, unknown>
}

/** Props */
export interface BasePieChartProps {
  /** 数据数组 */
  data: PieDataItem[]
  /** 图表高度 */
  height?: string
  /** 是否显示图例 */
  showLegend?: boolean
  /** 图例位置 */
  legendPosition?: 'right' | 'left' | 'top' | 'bottom'
  /** 内半径 */
  innerRadius?: string | number
  /** 外半径 */
  outerRadius?: string | number
  /** 中心位置 */
  center?: [string | number, string | number]
  /** 是否显示中心文字 */
  showCenterText?: boolean
  /** 中心上方文字 */
  centerTopText?: string
  /** 中心下方文字 (数值) */
  centerBottomText?: string | number
  /** 总计文字 (用于中心上方) */
  totalText?: string
  /** 是否可点击 */
  clickable?: boolean
}

const props = withDefaults(defineProps<BasePieChartProps>(), {
  height: '200px',
  showLegend: true,
  legendPosition: 'right',
  innerRadius: '40%',
  outerRadius: '65%',
  center: () => ['35%', '50%'],
  showCenterText: true,
  totalText: '总计',
  clickable: false
})

const emit = defineEmits<{
  click: [item: PieDataItem, index: number]
}>()

/** 数据总计 */
const _total = computed(() => props.data.reduce((sum, item) => sum + item.value, 0))

/** 图表配置 */
const chartOption = computed<EChartsOption>(() => {
  // 图例位置配置
  const legendConfig: Record<string, unknown> = {
    show: props.showLegend,
    orient:
      props.legendPosition === 'top' || props.legendPosition === 'bottom'
        ? 'horizontal'
        : 'vertical',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 12 }
  }

  if (props.legendPosition === 'right') {
    legendConfig.orient = 'vertical'
    legendConfig.right = 10
    legendConfig.top = 'center'
  } else if (props.legendPosition === 'left') {
    legendConfig.orient = 'vertical'
    legendConfig.left = 10
    legendConfig.top = 'center'
  } else if (props.legendPosition === 'top') {
    legendConfig.top = 10
    legendConfig.left = 'center'
  } else if (props.legendPosition === 'bottom') {
    legendConfig.bottom = 10
    legendConfig.left = 'center'
  }

  // 构建图形数组
  const graphics: Record<string, unknown>[] = []

  // 添加中心文字
  if (props.showCenterText && props.centerBottomText !== undefined) {
    graphics.push({
      type: 'group',
      left: props.center[0],
      top: props.center[1],
      bounding: 'raw',
      children: [
        {
          type: 'text',
          left: 'center',
          top: -20,
          style: {
            fill: '#909399',
            text: props.centerTopText || props.totalText,
            font: '14px "Microsoft YaHei", sans-serif'
          }
        },
        {
          type: 'text',
          left: 'center',
          top: 5,
          style: {
            fill: '#303133',
            text: String(props.centerBottomText),
            font: 'bold 24px "DIN Alternate", "Helvetica Neue", sans-serif'
          }
        }
      ]
    })
  }

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) => {
        return `${params.name}<br/>数量: ${params.value}个<br/>占比: ${params.percent}%`
      }
    },
    legend: legendConfig,
    series: [
      {
        type: 'pie',
        radius: [props.innerRadius, props.outerRadius],
        center: props.center,
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 4,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.05)'
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 12
          }
        },
        labelLine: { show: false },
        data: props.data.map((item, index) => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color:
              item.color ||
              getGradientColor(
                item.color || `hsl(${index * 60}, 70%, 50%)`,
                `${item.color || `hsl(${index * 60}, 70%, 50%)`}CC`
              )
          }
        }))
      }
    ],
    graphic: graphics
  }
})

/** 处理图表点击 */
const handleChartClick = (params: { dataIndex: number }) => {
  if (!props.clickable) {
    return
  }

  const index = params.dataIndex
  if (index >= 0 && index < props.data.length) {
    emit('click', props.data[index], index)
  }
}
</script>

<template>
  <div class="base-pie-chart">
    <v-chart
      :option="chartOption"
      :autoresize="true"
      :style="{ height }"
      @click="handleChartClick"
    />
  </div>
</template>

<style scoped>
.base-pie-chart {
  width: 100%;
  position: relative;
}
</style>
