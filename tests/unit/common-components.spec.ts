/**
 * 通用组件单元测试
 *
 * 测试 src/components/common/ 中的组件功能
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  SkeletonLoader,
  EmptyState,
  TransitionWrapper
} from '@/shared/ui'

describe('SkeletonLoader Component', () => {
  it('should render table type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'table',
        rows: 3,
        columns: 4
      }
    })

    expect(wrapper.find('.skeleton-table').exists()).toBe(true)
    expect(wrapper.findAll('.skeleton-table__row')).toHaveLength(3)
  })

  it('should render card type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'card',
        showAvatar: true
      }
    })

    expect(wrapper.find('.skeleton-card').exists()).toBe(true)
    expect(wrapper.find('.skeleton-card__avatar').exists()).toBe(true)
  })

  it('should render list type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'list',
        rows: 5
      }
    })

    expect(wrapper.find('.skeleton-list').exists()).toBe(true)
    expect(wrapper.findAll('.skeleton-list__item')).toHaveLength(5)
  })

  it('should render chart type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'chart',
        chartHeight: '250px'
      }
    })

    expect(wrapper.find('.skeleton-chart').exists()).toBe(true)
  })

  it('should render form type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'form',
        rows: 4
      }
    })

    expect(wrapper.find('.skeleton-form').exists()).toBe(true)
    expect(wrapper.findAll('.skeleton-form__field')).toHaveLength(4)
  })

  it('should render basic type skeleton', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'basic',
        width: '200px',
        height: '100px'
      }
    })

    expect(wrapper.find('.skeleton-basic').exists()).toBe(true)
  })

  it('should apply dark theme when dark prop is true', () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        type: 'basic',
        dark: true
      }
    })

    expect(wrapper.find('.skeleton-loader--dark').exists()).toBe(true)
  })
})

describe('EmptyState Component', () => {
  it('should render empty type with default text', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty'
      }
    })

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('should render no-result type', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'no-result'
      }
    })

    expect(wrapper.find('.empty-state--no-result').exists()).toBe(true)
    expect(wrapper.text()).toContain('未找到相关内容')
  })

  it('should render error type', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'error'
      }
    })

    expect(wrapper.find('.empty-state--error').exists()).toBe(true)
    expect(wrapper.text()).toContain('出错了')
  })

  it('should render network type', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'network'
      }
    })

    expect(wrapper.find('.empty-state--network').exists()).toBe(true)
    expect(wrapper.text()).toContain('网络连接失败')
  })

  it('should render loading type', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'loading'
      }
    })

    expect(wrapper.find('.empty-state--loading').exists()).toBe(true)
    expect(wrapper.text()).toContain('加载中')
  })

  it('should render with custom title and description', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty',
        title: '自定义标题',
        description: '自定义描述'
      }
    })

    expect(wrapper.text()).toContain('自定义标题')
    expect(wrapper.text()).toContain('自定义描述')
  })

  it('should render action button when showAction is true', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'error',
        showAction: true,
        actionText: '重试'
      }
    })

    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('button').text()).toBe('重试')
  })

  it('should emit action event when button is clicked', async () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'error',
        showAction: true,
        actionText: '重试'
      }
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
  })

  it('should render with size variants', () => {
    const smallWrapper = mount(EmptyState, {
      props: {
        type: 'empty',
        size: 'small'
      }
    })

    const largeWrapper = mount(EmptyState, {
      props: {
        type: 'empty',
        size: 'large'
      }
    })

    expect(smallWrapper.find('.empty-state--small').exists()).toBe(true)
    expect(largeWrapper.find('.empty-state--large').exists()).toBe(true)
  })

  it('should render icon slot', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty'
      },
      slots: {
        icon: '<span data-test="custom-icon">🎨</span>'
      }
    })

    expect(wrapper.find('[data-test="custom-icon"]').exists()).toBe(true)
  })

  it('should render title slot', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty'
      },
      slots: {
        title: '<h2>Custom Title</h2>'
      }
    })

    expect(wrapper.html()).toContain('Custom Title')
  })

  it('should render description slot', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty'
      },
      slots: {
        description: '<p>Custom Description</p>'
      }
    })

    expect(wrapper.html()).toContain('Custom Description')
  })

  it('should render action slot', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty',
        showAction: true
      },
      slots: {
        action: '<button data-test="custom-action">Custom Action</button>'
      }
    })

    expect(wrapper.find('[data-test="custom-action"]').exists()).toBe(true)
  })

  it('should render extra slot', () => {
    const wrapper = mount(EmptyState, {
      props: {
        type: 'empty'
      },
      slots: {
        extra: '<div data-test="extra-content">Extra Content</div>'
      }
    })

    expect(wrapper.find('[data-test="extra-content"]').exists()).toBe(true)
  })
})

describe('TransitionWrapper Component', () => {
  it('should render default slot content', () => {
    const wrapper = mount(TransitionWrapper, {
      slots: {
        default: '<div class="test-content">Content</div>'
      }
    })

    expect(wrapper.find('.test-content').exists()).toBe(true)
  })

  it('should apply correct transition class for fade type', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'fade'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    // TransitionWrapper renders a transition element with the computed name
    expect(wrapper.vm.transitionName).toBe('el-fade')
  })

  it('should apply correct transition class for slide type', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'slide',
        direction: 'up'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    expect(wrapper.vm.transitionName).toBe('slide-up')
  })

  it('should apply correct transition class for slide-fade type', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'slide-fade'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    expect(wrapper.vm.transitionName).toBe('slide-fade')
  })

  it('should apply correct transition class for zoom type', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'zoom'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    expect(wrapper.vm.transitionName).toBe('el-zoom-in')
  })

  it('should apply correct transition class for bounce type', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'bounce'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    expect(wrapper.vm.transitionName).toBe('bounce')
  })

  it('should support custom transition name', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'custom',
        customName: 'my-custom-transition'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    expect(wrapper.vm.transitionName).toBe('my-custom-transition')
  })

  it('should emit lifecycle events', () => {
    const wrapper = mount(TransitionWrapper, {
      props: {
        type: 'fade'
      },
      slots: {
        default: '<div>Content</div>'
      }
    })

    // Trigger events
    wrapper.vm.handleBeforeEnter()
    wrapper.vm.handleEnter()
    wrapper.vm.handleAfterEnter()
    wrapper.vm.handleBeforeLeave()
    wrapper.vm.handleLeave()
    wrapper.vm.handleAfterLeave()

    expect(wrapper.emitted('beforeEnter')).toBeTruthy()
    expect(wrapper.emitted('enter')).toBeTruthy()
    expect(wrapper.emitted('afterEnter')).toBeTruthy()
    expect(wrapper.emitted('beforeLeave')).toBeTruthy()
    expect(wrapper.emitted('leave')).toBeTruthy()
    expect(wrapper.emitted('afterLeave')).toBeTruthy()
  })
})
