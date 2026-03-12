/**
 * PageHeader Component Tests
 * 
 * Unit tests for PageHeader component
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import PageHeader from '../PageHeader.vue'

// Create mock router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/test', component: { template: '<div>Test</div>' } }
  ]
})

describe('PageHeader', () => {
  describe('Basic Rendering', () => {
    it('should render with title', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '页面标题'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header__title').text()).toBe('页面标题')
    })

    it('should render with description', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          description: '这是页面描述'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header__description').text()).toBe('这是页面描述')
    })

    it('should render without description', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header__description').exists()).toBe(false)
    })
  })

  describe('Breadcrumb Navigation', () => {
    it('should not render breadcrumb by default', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header__breadcrumb').exists()).toBe(false)
    })

    it('should render breadcrumb with items', () => {
      const breadcrumb = [
        { title: '首页', path: '/' },
        { title: '列表', path: '/list' },
        { title: '详情' }
      ]

      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          breadcrumb
        },
        global: {
          plugins: [router],
          stubs: {
            'el-breadcrumb': {
              template: '<div class="el-breadcrumb"><slot /></div>'
            },
            'el-breadcrumb-item': {
              template: '<div class="el-breadcrumb-item"><slot /></div>',
              props: ['to']
            }
          }
        }
      })

      expect(wrapper.find('.page-header__breadcrumb').exists()).toBe(true)
      const items = wrapper.findAll('.el-breadcrumb-item')
      expect(items).toHaveLength(3)
    })

    it('should handle disabled breadcrumb items', () => {
      const breadcrumb = [
        { title: '首页', path: '/', disabled: true },
        { title: '当前页' }
      ]

      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          breadcrumb
        },
        global: {
          plugins: [router],
          stubs: {
            'el-breadcrumb': {
              template: '<div class="el-breadcrumb"><slot /></div>'
            },
            'el-breadcrumb-item': {
              template: '<div class="el-breadcrumb-item"><slot /></div>',
              props: ['to']
            }
          }
        }
      })

      expect(wrapper.find('.breadcrumb-item--disabled').exists()).toBe(true)
    })
  })

  describe('Back Button', () => {
    it('should not show back button by default', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header__back').exists()).toBe(false)
    })

    it('should show back button when enabled', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          showBack: true
        },
        global: {
          plugins: [router],
          stubs: {
            'el-button': {
              template: '<button class="el-button page-header__back"><slot /></button>',
              props: ['link']
            },
            'el-icon': {
              template: '<span class="el-icon"><slot /></span>'
            }
          }
        }
      })

      expect(wrapper.find('.page-header__back').exists()).toBe(true)
    })

    it('should emit back event when clicked', async () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          showBack: true
        },
        global: {
          plugins: [router],
          stubs: {
            'el-button': {
              template: '<button class="el-button page-header__back" @click="$emit(\'click\')"><slot /></button>',
              props: ['link'],
              emits: ['click']
            },
            'el-icon': {
              template: '<span class="el-icon"><slot /></span>'
            }
          }
        }
      })

      await wrapper.find('.page-header__back').trigger('click')
      expect(wrapper.emitted('back')).toBeTruthy()
    })

    it('should use custom back text', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          showBack: true,
          backText: '返回列表'
        },
        global: {
          plugins: [router],
          stubs: {
            'el-button': {
              template: '<button class="el-button page-header__back"><slot /></button>',
              props: ['link']
            },
            'el-icon': {
              template: '<span class="el-icon"><slot /></span>'
            }
          }
        }
      })

      expect(wrapper.text()).toContain('返回列表')
    })
  })

  describe('Divider', () => {
    it('should show divider by default', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header--divider').exists()).toBe(true)
    })

    it('should hide divider when disabled', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题',
          divider: false
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.page-header--divider').exists()).toBe(false)
    })
  })

  describe('Slots', () => {
    it('should render title slot', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '默认标题'
        },
        slots: {
          title: '<span class="custom-title">自定义标题</span>'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.custom-title').text()).toBe('自定义标题')
    })

    it('should render description slot', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        slots: {
          description: '<span class="custom-desc">自定义描述</span>'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.custom-desc').text()).toBe('自定义描述')
    })

    it('should render extra slot', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        slots: {
          extra: '<span class="custom-extra">额外内容</span>'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.custom-extra').text()).toBe('额外内容')
    })

    it('should render actions slot', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        slots: {
          actions: '<button class="custom-action">操作按钮</button>'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.custom-action').text()).toBe('操作按钮')
    })

    it('should render footer slot', () => {
      const wrapper = mount(PageHeader, {
        props: {
          title: '标题'
        },
        slots: {
          footer: '<div class="custom-footer">底部内容</div>'
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('.custom-footer').text()).toBe('底部内容')
    })
  })
})
