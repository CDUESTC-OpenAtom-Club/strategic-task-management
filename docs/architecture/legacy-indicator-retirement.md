# legacy-indicator 退场说明

## 当前结论

`src/3-features/legacy-indicator` 已不再处于正式运行链路中。

仓内检查结果：

- 路由已统一指向 `src/3-features/indicator`
- `src/tests` 中不存在对 `legacy-indicator` 的正式依赖
- `legacy-indicator` 目录仅剩历史实现与兼容层残留

因此，本轮治理将其从 `src` 主干源码结构中移出，转入文档归档目录保存，避免继续：

- 污染顶层架构认知
- 影响超大文件统计
- 误导新改动继续落入旧模块

## 归档位置

归档后目录：

- `docs/archive/legacy-indicator-retired/`

该目录仅用于历史查阅，不再参与正式开发与运行。

## 后续规则

1. 新需求不得再进入 `legacy-indicator`。
2. 指标相关主线实现只允许进入 `src/3-features/indicator`。
3. 如果仍需引用历史逻辑，必须先迁入现役模块，再删除归档副本。
