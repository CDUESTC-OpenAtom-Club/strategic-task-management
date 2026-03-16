/**
 * StatusBadge Component Tests
 * 
 * Unit tests for StatusBadge component
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '../StatusBadge.vue'

describe('StatusBadge', () => {
  describe('Basic Rendering', () => {
    it('should render with text', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '已完成'
        }
      })

      expect(wrapper.text()).toBe('已完成')
      expect(wrapper.find('.status-badge').exists()).toBe(true)
    })

    it('should render with default type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '测试'
        }
      })

      expect(wrapper.find('.status-badge--default').exists()).toBe(true)
    })
  })

  describe('Status Types', () => {
    it('should render success type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '成功',
          type: 'success'
        }
      })

      expect(wrapper.find('.status-badge--success').exists()).toBe(true)
    })

    it('should render info type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '信息',
          type: 'info'
        }
      })

      expect(wrapper.find('.status-badge--info').exists()).toBe(true)
    })

    it('should render warning type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '警告',
          type: 'warning'
        }
      })

      expect(wrapper.find('.status-badge--warning').exists()).toBe(true)
    })

    it('should render danger type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '危险',
          type: 'danger'
        }
      })

      expect(wrapper.find('.status-badge--danger').exists()).toBe(true)
    })

    it('should render primary type', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '主要',
          type: 'primary'
        }
      })

      expect(wrapper.find('.status-badge--primary').exists()).toBe(true)
    })
  })

  describe('Sizes', () => {
    it('should render small size', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '小',
          size: 'small'
        }
      })

      expect(wrapper.find('.status-badge--small').exists()).toBe(true)
    })

    it('should render default size', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '默认',
          size: 'default'
        }
      })

      expect(wrapper.find('.status-badge--default').exists()).toBe(true)
    })

    it('should render large size', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '大',
          size: 'large'
        }
      })

      expect(wrapper.find('.status-badge--large').exists()).toBe(true)
    })
  })

  describe('Dot Indicator', () => {
    it('should render without dot by default', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '无圆点'
        }
      })

      expect(wrapper.find('.status-badge__dot').exists()).toBe(false)
    })

    it('should render with dot when enabled', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '有圆点',
          dot: true
        }
      })

      expect(wrapper.find('.status-badge__dot').exists()).toBe(true)
      expect(wrapper.find('.status-badge--dot').exists()).toBe(true)
    })
  })

  describe('Custom Color', () => {
    it('should apply custom color', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '自定义颜色',
          color: '#ff0000'
        }
      })

      const badge = wrapper.find('.status-badge')
      const style = badge.attributes('style')
      
      expect(style).toContain('color: rgb(255, 0, 0)')
      expect(style).toContain('border-color: rgb(255, 0, 0)')
    })

    it('should override type color with custom color', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: '覆盖颜色',
          type: 'success',
          color: '#0000ff'
        }
      })

      const badge = wrapper.find('.status-badge')
      const style = badge.attributes('style')
      
      expect(style).toContain('color: rgb(0, 0, 255)')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          text: ''
        }
      })

      expect(wrapper.find('.status-badge__text').text()).toBe('')
    })

    it('should handle long text', () => {
      const longText = '这是一个非常长的状态文本用于测试组件的显示效果'
      const wrapper = mount(StatusBadge, {
        props: {
          text: longText
        }
      })

      expect(wrapper.text()).toBe(longText)
    })

    it('should handle special characters', () => {
      const specialText = '<script>alert("xss")</script>'
      const wrapper = mount(StatusBadge, {
        props: {
          text: specialText
        }
      })

      // Vue automatically escapes HTML
      expect(wrapper.html()).not.toContain('<script>')
      expect(wrapper.text()).toBe(specialText)
    })
  })
})
