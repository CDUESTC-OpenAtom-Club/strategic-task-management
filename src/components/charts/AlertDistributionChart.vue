<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

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
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2
      },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.2)' }
      },
      labelLine: { show: false },
      data: [
        { value: props.severe, name: '严重预警', itemStyle: { color: '#F56C6C' } },
        { value: props.moderate, name: '中度预警', itemStyle: { color: '#E6A23C' } },
        { value: props.normal, name: '正常', itemStyle: { color: '#67C23A' } }
      ]
    }
  ]
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
    <div class="chart-summary">
      <span class="total-label">共 {{ total }} 个指标</span>
    </div>
  </div>
</template>

<style scoped>
.alert-distribution-chart {
  width: 100%;
  position: relative;
}

.chart-summary {
  text-align: center;
  margin-top: -8px;
}

.total-label {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
