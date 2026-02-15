/**
 * Commitlint 配置文件
 * 规范提交信息格式，遵循 Conventional Commits 规范
 * 
 * 提交格式: <type>(<scope>): <subject>
 * 
 * type 类型:
 * - feat: 新功能
 * - fix: 修复 bug
 * - docs: 文档更新
 * - style: 代码格式（不影响代码运行的变动）
 * - refactor: 重构（既不是新增功能，也不是修复 bug）
 * - perf: 性能优化
 * - test: 测试相关
 * - chore: 构建过程或辅助工具的变动
 * - ci: CI 配置相关
 * - revert: 回滚提交
 * 
 * 示例:
 * - feat(auth): 添加用户登录功能
 * - fix(indicator): 修复指标计算错误
 * - docs: 更新 README 文档
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type 必须是以下之一
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复 bug
        'docs',     // 文档更新
        'style',    // 代码格式
        'refactor', // 重构
        'perf',     // 性能优化
        'test',     // 测试
        'chore',    // 构建/工具
        'ci',       // CI 配置
        'revert'    // 回滚
      ]
    ],
    // type 不能为空
    'type-empty': [2, 'never'],
    // subject 不能为空
    'subject-empty': [2, 'never'],
    // subject 最大长度 100
    'subject-max-length': [2, 'always', 100],
    // subject 不以句号结尾
    'subject-full-stop': [2, 'never', '.'],
    // header 最大长度 100
    'header-max-length': [2, 'always', 100]
  }
}
