<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, TitleComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { SourcePieData } from '@/types'
import { getColorByIndex } from '@/utils/colors'

use([PieChart, TooltipComponent, LegendComponent, TitleComponent, GraphicComponent, CanvasRenderer])

// Props
interface Props {
  data: SourcePieData[]
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '任务来源分布'
})

// Emits
const emit = defineEmits<{
  click: [source: string]
}>()

// 计算总任务数
const totalTasks = computed(() =>
  props.data.reduce((sum, item) => sum + item.value, 0)
)

// ECharts 配置
const chartOption = computed(() => ({
  title: {
    text: props.title,
    left: 'center',
    textStyle: {
      fontSize: 16,
      fontWeight: 600,
      color: '#333'
    }
  },
  tooltip: {
    trigger: 'item',
    formatter: (params: any) => {
      return `
        <div style="padding: 8px;">
          <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
          <div>任务数: <strong>${params.value}</strong></div>
          <div>占比: <strong>${params.percent.toFixed(1)}%</strong></div>
        </div>
      `
    }
  },
  legend: {
    orient: 'vertical',
    right: 10,
    top: 'center',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: {
      fontSize: 12,
      color: '#666'
    },
    formatter: (name: string) => {
      const item = props.data.find(d => d.name === name)
      if (item) {
        return `${name} (${item.value})`
      }
      return name
    }
  },
  series: [{
    type: 'pie',
    radius: ['40%', '65%'],
    center: ['40%', '50%'],
    avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 4,
        shadowBlur: 10,
        shadowColor: 'rgba(0, 0, 0, 0.05)'
      },
      label: {
        show: false,
        position: 'center'
      },
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

    labelLine: {
      show: false
    },
    data: props.data.map((item, index) => ({
      value: item.value,
      name: item.name,
      itemStyle: {
        color: getColorByIndex(index)
      }
    }))
  }],
  graphic: {
    type: 'group',
    left: '40%',
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
          text: totalTasks.value,
          font: 'bold 30px "DIN Alternate", "Helvetica Neue", sans-serif'
        }
      }
    ]
  }
})),


// 处理图表点击事件
const handleChartClick = (params: any) => {
  if (params.componentType === 'series') {
    emit('click', params.name)
  }
}
</script>

<template>
  <div class="source-pie-chart">
    <v-chart
      :option="chartOption"
      autoresize
      style="height: 350px; cursor: pointer;"
      @click="handleChartClick"
    />
  </div>
</template>

<style scoped>
.source-pie-chart {
  width: 100%;
  position: relative;
}
</style>
