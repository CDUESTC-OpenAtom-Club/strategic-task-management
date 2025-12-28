<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import { getColorByIndex, getGradientColor } from '@/utils/colors'

use([PieChart, TooltipComponent, LegendComponent, GraphicComponent, CanvasRenderer])

const props = defineProps<{
  severe: number
  moderate: number
  normal: number
}>()

const emit = defineEmits<{
  click: [level: 'severe' | 'moderate' | 'normal']
}>()

const total = computed(() => props.severe + props.moderate + props.normal)

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: (params: any) => {
      const levelMap: Record<string, string> = {
        '严重预警': '进度 < 30%',
        '中度预警': '30% ≤ 进度 < 60%',
        '正常': '进度 ≥ 60%'
      }
      return `${params.name}<br/>数量: ${params.value}个<br/>占比: ${params.percent}%<br/>${levelMap[params.name] || ''}`
    }
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 12 }
  },
  series: [
    {
      name: '预警分布',
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['35%', '50%'],
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
        data: [
          { 
            value: props.severe, 
            name: '严重预警', 
            itemStyle: { 
              color: getGradientColor('#F56C6C', '#F56C6CCC') 
            } 
          },
          { 
            value: props.moderate, 
            name: '中度预警', 
            itemStyle: { 
              color: getGradientColor('#E6A23C', '#E6A23CCC') 
            } 
          },
          { 
            value: props.normal, 
            name: '正常', 
            itemStyle: { 
              color: getGradientColor('#67C23A', '#67C23ACC') 
            } 
          }
        ]
    }
  ],
  graphic: {
    type: 'group',
    left: '35%',
    top: '50%',
    bounding: 'raw',
    children: [
      {
        type: 'text',
        left: 'center',
        top: -20,
        style: {
          fill: '#909399',
          text: '总计',
          font: '14px "Microsoft YaHei", sans-serif'
        }
      },
      {
        type: 'text',
        left: 'center',
        top: 5,
        style: {
          fill: '#303133',
          text: total.value,
            font: 'bold 24px "DIN Alternate", "Helvetica Neue", sans-serif'
        }
      }
    ]
  }
}))

const handleChartClick = (params: any) => {
  const levelMap: Record<string, 'severe' | 'moderate' | 'normal'> = {
    '严重预警': 'severe',
    '中度预警': 'moderate',
    '正常': 'normal'
  }
  const level = levelMap[params.name]
  if (level) emit('click', level)
}
</script>

<template>
  <div class="alert-distribution-chart">
    <v-chart 
      :option="chartOption" 
      autoresize 
      style="height: 200px" 
      @click="handleChartClick"
    />
  </div>
</template>

<style scoped>
.alert-distribution-chart {
  width: 100%;
  position: relative;
}
</style>
