<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { getColorByIndex, getGradientColor } from '@/utils/colors'

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
            value: props.basicScore, 
            name: '基础性指标', 
            itemStyle: { 
              color: getGradientColor('#409EFF', '#409EFFCC') 
            } 
          },
          { 
            value: props.developmentScore, 
            name: '发展性指标', 
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
          text: '总分',
          font: '14px "Microsoft YaHei", sans-serif'
        }
      },
      {
        type: 'text',
        left: 'center',
        top: 5,
        style: {
          fill: '#303133',
          text: totalScore.value,
            font: 'bold 24px "DIN Alternate", "Helvetica Neue", sans-serif'
        }
      }
    ]
  }
}))
</script>

<template>
  <div class="score-composition-chart">
    <v-chart :option="chartOption" autoresize style="height: 200px" />
  </div>
</template>

<style scoped>
.score-composition-chart {
  width: 100%;
  position: relative;
}
</style>
