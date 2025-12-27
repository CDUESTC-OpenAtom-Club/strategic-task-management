<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([PieChart, TooltipComponent, LegendComponent, GraphicComponent, CanvasRenderer])

const props = withDefaults(defineProps<{
  basicScore: number
  developmentScore: number
  maxBasicScore?: number
  maxDevelopmentScore?: number
}>(), {
  maxBasicScore: 100,
  maxDevelopmentScore: 20
})

const totalScore = computed(() => props.basicScore + props.developmentScore)
const maxTotalScore = computed(() => props.maxBasicScore + props.maxDevelopmentScore)

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: (params: any) => {
      const max = params.name === '基础性指标' ? props.maxBasicScore : props.maxDevelopmentScore
      return `${params.name}<br/>得分: ${params.value}分 / ${max}分<br/>占比: ${params.percent}%`
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
      name: '得分构成',
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
        { value: props.basicScore, name: '基础性指标', itemStyle: { color: '#409EFF' } },
        { value: props.developmentScore, name: '发展性指标', itemStyle: { color: '#67C23A' } }
      ]
    }
  ]
}))
</script>

<template>
  <div class="score-composition-chart">
    <v-chart :option="chartOption" autoresize style="height: 200px" />
    <div class="chart-summary">
      <span class="total-label">总得分 {{ totalScore }} / {{ maxTotalScore }} 分</span>
    </div>
  </div>
</template>

<style scoped>
.score-composition-chart {
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
