# 通用组件

```ts
import { DataTable, DataForm, SkeletonLoader, EmptyState, TransitionWrapper } from '@/components/common'
```

## DataTable

```vue
<DataTable :data="data" :columns="columns" :pagination="pagination" />
```

## DataForm

```vue
<DataForm :model="formData" :fields="fields" @submit="handleSubmit" />
```

字段类型: `input`, `textarea`, `select`, `multiselect`, `radio`, `checkbox`, `switch`, `date`, `daterange`, `number`, `password`

## SkeletonLoader

```vue
<SkeletonLoader type="table|card|list|chart|form" :rows="5" />
```

## EmptyState

```vue
<EmptyState type="empty|no-result|error|network" />
<EmptyState type="error" :show-action="true" action-text="重试" @action="handleRetry" />
```

## TransitionWrapper

```vue
<TransitionWrapper type="fade|slide|slide-fade|zoom|bounce">
  <div>内容</div>
</TransitionWrapper>
```
