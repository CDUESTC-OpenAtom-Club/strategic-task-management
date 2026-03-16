/**
 * NProgress 配置
 *
 * 路由切换时显示进度条
 */

import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// 配置 NProgress
NProgress.configure({
  // 最小进度百分比
  minimum: 0.1,
  // 动画速度 (ms)
  speed: 200,
  // 是否显示加载圈圈
  showSpinner: false,
  // 进度条容器 CSS 类名
  trickleSpeed: 200,
  // 父容器
  parent: 'body'
})

/**
 * 开始进度条
 */
export function startProgress(): void {
  NProgress.start()
}

/**
 * 结束进度条
 */
export function doneProgress(): void {
  NProgress.done()
}

/**
 * 设置进度
 * @param n 进度百分比 (0-1)
 */
export function setProgress(n: number): void {
  NProgress.set(n)
}

/**
 * 增加进度
 * @param amount 增加量
 */
export function incrementProgress(amount?: number): void {
  NProgress.inc(amount)
}

export default NProgress
