<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ComparisonItem } from '@/types'
import { getProgressColor } from '@/utils/colors'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, GraphicComponent, CanvasRenderer])

// Props
interface Props {
  data: ComparisonItem[]
  title?: string
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '部门进度对比',
  clickable: false
})

// Emits
const emit = defineEmits<{
  click: [item: ComparisonItem]
}>()

// 已排序的数据（按进度从高到低）
const sortedData = computed(() =>
  [...props.data].sort((a, b) => b.progress - a.progress)
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
    trigger: 'axis',
    axisPointer: {
      type: 'shadow'
    },
    formatter: (params: any) => {
      if (!params || !params[0]) return ''
      const item = sortedData.value[params[0].dataIndex]
      if (!item) return ''
      return `
        <div style="padding: 8px;">
          <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            ${item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `${item.rank}.`} ${item.dept}
          </div>
          <div style="margin: 4px 0;">进度: <strong>${item.progress}%</strong></div>
          <div style="margin: 4px 0;">得分: <strong>${item.score}</strong>分</div>
          <div style="margin: 4px 0;">完成率: <strong>${item.completionRate}%</strong></div>
          <div style="margin: 4px 0;">指标总数: ${item.totalIndicators}</div>
          <div style="margin: 4px 0;">已完成: ${item.completedIndicators}</div>
          <div style="margin: 4px 0;">预警数: <span style="color: ${item.alertCount > 0 ? '#F56C6C' : '#67C23A'}">${item.alertCount}</span></div>
        </div>
      `
    }
  },
  grid: {
    left: '20%',
    right: '10%',
    top: '15%',
    bottom: '10%',
    containLabel: false
  },
  xAxis: {
    type: 'value',
    max: 100,
    axisLabel: {
      formatter: '{value}%',
      fontSize: 12,
      color: '#666'
    },
    splitLine: {
      lineStyle: {
        color: '#E4E7ED',
        type: 'dashed'
      }
    }
  },
  yAxis: {
    type: 'category',
    data: sortedData.value.map(item => item.dept),
    inverse: true, // 第一名在最上方
    axisLabel: {
      fontSize: 12,
      color: '#333',
      formatter: (value: string, index: number) => {
        const rank = index + 1
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
        // 限制部门名称长度
        const shortName = value.length > 12 ? value.substring(0, 12) + '...' : value
        return `${medal} ${shortName}`
      }
    },
    axisTick: {
      show: false
    },
    axisLine: {
      show: false
    }
  },
  series: [{
    type: 'bar',
    data: sortedData.value.map(item => ({
      value: item.progress,
      itemStyle: {
        color: getProgressColor(item.progress),
        borderRadius: [0, 4, 4, 0]
      }
    })),
    barMaxWidth: 30,
    label: {
      show: true,
      position: 'right',
      formatter: '{c}%',
      fontSize: 12,
      fontWeight: 'bold',
      color: '#333'
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      }
    }
  }]
}))

// 处理图表点击事件
const handleChartClick = (params: any) => {
  if (props.clickable && params.componentType === 'series') {
    const item = sortedData.value[params.dataIndex]
    emit('click', item)
  }
}
</script>

<template>
  <div class="comparison-chart">
    <v-chart
      :option="chartOption"
      autoresize
      :style="{ height: Math.max(data.length * 50 + 100, 300) + 'px', cursor: clickable ? 'pointer' : 'default' }"
      @click="handleChartClick"
    />
  </div>
</template>

<style scoped>
.comparison-chart {
  width: 100%;
  position: relative;
}
</style>
