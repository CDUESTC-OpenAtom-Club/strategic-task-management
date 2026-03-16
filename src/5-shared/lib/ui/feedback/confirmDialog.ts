/**
 * ConfirmDialog - 确认对话框模块
 *
 * 职责:
 * - 提供统一的确认对话框
 * - 支持自定义标题和内容
 * - 支持异步操作
 * - 支持不同类型的提示
 */
import { ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { ElMessageBoxOptions, MessageBoxData } from 'element-plus'

/** 对话框类型 */
export type DialogType = 'warning' | 'info' | 'success' | 'error'

/** 确认对话框配置 */
export interface ConfirmDialogOptions {
  /** 标题 */
  title?: string
  /** 内容 */
  message: string
  /** 类型 */
  type?: DialogType
  /** 确认按钮文字 */
  confirmButtonText?: string
  /** 取消按钮文字 */
  cancelButtonText?: string
  /** 是否显示取消按钮 */
  showCancelButton?: boolean
  /** 确认按钮类型 */
  confirmButtonType?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /** 是否在按下 ESC 键时关闭 */
  closeOnPressEscape?: boolean
  /** 是否在点击遮罩层时关闭 */
  closeOnClickModal?: boolean
  /** 是否显示输入框 */
  showInput?: boolean
  /** 输入框占位符 */
  inputPlaceholder?: string
  /** 输入框验证 */
  inputValidator?: (value: string) => boolean | string
  /** 输入框错误提示 */
  inputErrorMessage?: string
}

/** 显示确认对话框 */
export async function showConfirm(options: ConfirmDialogOptions): Promise<MessageBoxData> {
  const {
    title = '提示',
    message,
    type = 'warning',
    confirmButtonText = '确定',
    cancelButtonText = '取消',
    showCancelButton = true,
    confirmButtonType = type === 'warning' ? 'warning' : 'primary',
    closeOnPressEscape = true,
    closeOnClickModal = false,
    showInput = false,
    inputPlaceholder = '',
    inputValidator,
    inputErrorMessage = '输入不合法'
  } = options

  const config: ElMessageBoxOptions = {
    title,
    message,
    type,
    confirmButtonText,
    cancelButtonText,
    showCancelButton,
    confirmButtonClass: `el-button--${confirmButtonType}`,
    closeOnPressEscape,
    closeOnClickModal,
    showInput,
    inputPlaceholder,
    inputValidator,
    inputErrorMessage,
    center: false,
    draggable: true
  }

  return ElMessageBox(config)
}

/** 显示删除确认对话框 */
export async function showDeleteConfirm(itemName?: string): Promise<MessageBoxData> {
  return showConfirm({
    title: '确认删除',
    message: itemName
      ? `确定要删除"${itemName}"吗？此操作不可恢复。`
      : '确定要删除吗？此操作不可恢复。',
    type: 'warning',
    confirmButtonText: '删除',
    confirmButtonType: 'danger'
  })
}

/** 显示提交确认对话框 */
export async function showSubmitConfirm(message?: string): Promise<MessageBoxData> {
  return showConfirm({
    title: '确认提交',
    message: message || '确定要提交吗？',
    type: 'info',
    confirmButtonText: '提交',
    confirmButtonType: 'primary'
  })
}

/** 显示审批确认对话框 */
export async function showApprovalConfirm(action: 'approve' | 'reject'): Promise<MessageBoxData> {
  const isApprove = action === 'approve'
  return showConfirm({
    title: isApprove ? '确认通过' : '确认驳回',
    message: isApprove ? '确定要通过此审批吗？' : '确定要驳回此审批吗？',
    type: isApprove ? 'success' : 'warning',
    confirmButtonText: isApprove ? '通过' : '驳回',
    confirmButtonType: isApprove ? 'success' : 'danger',
    showInput: !isApprove,
    inputPlaceholder: !isApprove ? '请输入驳回原因（必填）' : '',
    inputValidator: !isApprove ? (value: string) => !!value.trim() || '请输入驳回原因' : undefined
  })
}

/** 组合式函数 - 确认对话框 */
export function useConfirmDialog() {
  const loading = ref(false)

  const confirm = async (options: ConfirmDialogOptions) => {
    try {
      loading.value = true
      return await showConfirm(options)
    } finally {
      loading.value = false
    }
  }

  const confirmDelete = async (itemName?: string) => {
    try {
      loading.value = true
      return await showDeleteConfirm(itemName)
    } finally {
      loading.value = false
    }
  }

  const confirmSubmit = async (message?: string) => {
    try {
      loading.value = true
      return await showSubmitConfirm(message)
    } finally {
      loading.value = false
    }
  }

  const confirmApproval = async (action: 'approve' | 'reject') => {
    try {
      loading.value = true
      return await showApprovalConfirm(action)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    confirm,
    confirmDelete,
    confirmSubmit,
    confirmApproval
  }
}
