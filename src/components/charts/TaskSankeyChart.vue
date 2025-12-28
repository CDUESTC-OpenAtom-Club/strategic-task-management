<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent, TitleComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { SankeyData } from '@/types'

use([SankeyChart, TooltipComponent, TitleComponent, GraphicComponent, CanvasRenderer])

// Props
interface Props {
  data: SankeyData
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '任务流转图'
})

// Emits
const emit = defineEmits<{
  nodeClick: [nodeName: string]
  linkClick: [source: string, target: string]
}>()

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
    triggerOn: 'mousemove',
    formatter: (params: any) => {
      if (params.dataType === 'edge') {
        // 链接tooltip - 根据源节点判断显示任务数还是指标数
        // 战略发展部 -> 职能部门 显示"任务数"
        // 职能部门 -> 二级学院 显示"指标数"
        const isFromStrategic = params.data.source === '战略发展部'
        const label = isFromStrategic ? '任务数' : '指标数'
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.data.source} → ${params.data.target}</div>
            <div>${label}: <strong>${params.data.value}</strong></div>
          </div>
        `
      } else {
        // 节点tooltip - 根据层级显示不同文字
        // depth 0/1 是战略发展部和职能部门，显示"任务数"
        // depth 2 是二级学院，显示"指标数"
        const label = params.data?.depth === 2 ? '总指标数' : '总任务数'
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.name}</div>
            <div>${label}: <strong>${params.value}</strong></div>
          </div>
        `
      }
    }
  },
  series: [{
    type: 'sankey',
    layout: 'none',
    emphasis: {
      focus: 'adjacency'
    },
    data: props.data.nodes.map((node: any) => ({
      ...node,
      // 根据层级设置不同的颜色
      itemStyle: {
        color: node.depth === 0 ? '#409EFF' :  // 战略发展部 - 蓝色
               node.depth === 1 ? '#67C23A' :  // 职能部门 - 绿色
               node.depth === 2 ? '#E6A23C' :  // 二级学院 - 橙色
               '#909399'  // 其他 - 灰色
      }
    })),
    links: props.data.links,
    lineStyle: {
      color: 'gradient',
      curveness: 0.5,
      opacity: 0.3
    },
    label: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#333',
      formatter: (params: any) => {
        const name = params.name
        // 限制名称长度
        return name.length > 10 ? name.substring(0, 10) + '...' : name
      }
    },
    nodeWidth: 30,
    nodeGap: 15,
    layoutIterations: 32
  }],
  animationDuration: 800,
  animationEasing: 'cubicInOut'
}))

// 处理图表点击事件
const handleChartClick = (params: any) => {
  if (params.dataType === 'node') {
    // 节点点击
    emit('nodeClick', params.name)
  } else if (params.dataType === 'edge') {
    // 链接点击
    emit('linkClick', params.data.source, params.data.target)
  }
}
</script>

<template>
  <div class="sankey-chart">
    <v-chart
      v-if="props.data.nodes.length > 0 && props.data.links.length > 0"
      :option="chartOption"
      autoresize
      style="height: 500px; cursor: pointer;"
      @click="handleChartClick"
    />
    <el-empty
      v-else
      description="暂无任务流转数据"
      :image-size="120"
    >
      <template #description>
        <p style="color: #909399; font-size: 14px;">
          当前视角下暂无任务流转记录
        </p>
        <p style="color: #C0C4CC; font-size: 12px; margin-top: 8px;">
          请为部门分配指标任务后查看任务流转情况
        </p>
      </template>
    </el-empty>
  </div>
</template>

<style scoped>
.sankey-chart {
  width: 100%;
  position: relative;
}
</style>
