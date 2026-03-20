import type { App, Directive } from 'vue'

export const focusDirective: Directive = {
  mounted(el) {
    const input = el.querySelector('input') || el.querySelector('textarea') || el
    input?.focus()
  }
}

export function registerSharedDirectives(app: App): void {
  app.directive('focus', focusDirective)
}
