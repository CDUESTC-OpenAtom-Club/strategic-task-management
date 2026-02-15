# Type Definitions Documentation

This directory contains TypeScript type definitions for the SISM frontend application.

## Files

### `backend-aligned.ts`

Contains TypeScript interfaces that directly align with the backend database schema. These types use backend field names and should be used when communicating with the API.

**Key Features:**

- Direct mapping to PostgreSQL database schema
- Backend field naming conventions (snake_case in comments, camelCase in TypeScript)
- Complete enum definitions matching backend
- Type guards for API responses

### `index.ts`

Contains frontend-specific types and UI-related interfaces. These types use frontend terminology and conventions.

**Key Features:**

- UI component types
- Form state types
- Dashboard and visualization types
- Frontend-specific enums

## Terminology Mapping

The system uses different terminology in the backend vs frontend to better match user mental models:

| Backend Term                     | Frontend Term | Description                         |
| -------------------------------- | ------------- | ----------------------------------- |
| `strategic_task`                 | `Plan`        | Top-level strategic planning entity |
| `indicator` (at plan level)      | `Task`        | Work items under a Plan             |
| `indicator` (at execution level) | `Indicator`   | Measurable metrics with milestones  |

### Why This Mapping?

1. **Backend (`strategic_task`)**: Database uses this term for historical reasons and technical clarity
2. **Frontend (`Plan`)**: Users think of these as "plans" or "strategic plans", not "tasks"
3. **Backend (`indicator`)**: Database uses this term for all measurable items
4. **Frontend (`Task`/`Indicator`)**: Users distinguish between work items (tasks) and metrics (indicators)

## Usage Guidelines

### When to Use `backend-aligned.ts`

Use these types when:

- Making API calls
- Processing API responses
- Storing data that will be sent to the backend
- Writing API service layer code

```typescript
import { Plan, Task, ApiResponse } from '@/types/backend-aligned'

async function fetchPlan(planId: number): Promise<ApiResponse<Plan>> {
  const response = await axios.get(`/api/plans/${planId}`)
  return response.data
}
```

### When to Use `index.ts`

Use these types when:

- Building UI components
- Managing component state
- Handling form data
- Creating visualization data structures

```typescript
import { DashboardData, FilterState } from '@/types'

const dashboardData: DashboardData = {
  totalScore: 85,
  completionRate: 75
  // ...
}
```

### Type Conversion

When converting between backend and frontend types, create explicit conversion functions:

```typescript
// In a service or utility file
import { Plan as BackendPlan } from '@/types/backend-aligned'
import { StrategicTask as FrontendPlan } from '@/types'

export function convertBackendPlanToFrontend(backendPlan: BackendPlan): FrontendPlan {
  return {
    id: backendPlan.taskId.toString(),
    title: backendPlan.taskName,
    desc: backendPlan.taskDesc || ''
    // ... other field mappings
  }
}
```

## Type Safety Best Practices

### 1. Use Type Guards

```typescript
import { isApiError, isApiResponse } from '@/types/backend-aligned'

const response = await fetchData()
if (isApiError(response)) {
  // Handle error
  console.error(response.error.message)
} else if (isApiResponse(response)) {
  // Handle success
  processData(response.data)
}
```

### 2. Avoid `any`

Never use `any` type. Use `unknown` if the type is truly unknown, then narrow it with type guards.

```typescript
// Bad
function processData(data: any) {
  return data.value
}

// Good
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: number }).value
  }
  throw new Error('Invalid data structure')
}
```

### 3. Use Utility Types

```typescript
import { DeepPartial, RequireFields } from '@/types/backend-aligned'

// Make all fields optional for partial updates
type PartialTask = DeepPartial<Task>

// Require specific fields
type TaskWithRequired = RequireFields<Task, 'indicatorId' | 'taskId'>
```

### 4. Runtime Validation in Development

In development mode, validate API responses against TypeScript interfaces:

```typescript
if (import.meta.env.DEV) {
  validateApiResponse(response, expectedSchema)
}
```

## ESLint Rules

The project has ESLint rules to enforce terminology consistency:

- **Warning**: Using `strategic_task` or `strategicTask` in frontend code
- **Recommendation**: Use `plan` terminology instead

These rules help maintain consistency and prevent confusion between backend and frontend terminology.

## Testing

### Unit Tests

Test type conversions and type guards:

```typescript
import { describe, it, expect } from 'vitest'
import { isApiError, isApiResponse } from '@/types/backend-aligned'

describe('Type Guards', () => {
  it('should identify API errors correctly', () => {
    const error = { success: false, error: { code: 'ERR_001' } }
    expect(isApiError(error)).toBe(true)
  })
})
```

### Property-Based Tests

Test that type conversions preserve data integrity:

```typescript
import fc from 'fast-check'
import { convertBackendPlanToFrontend } from '@/services/converters'

fc.assert(
  fc.property(
    fc.record({
      taskId: fc.integer(),
      taskName: fc.string()
      // ... other fields
    }),
    backendPlan => {
      const frontendPlan = convertBackendPlanToFrontend(backendPlan)
      expect(frontendPlan.id).toBe(backendPlan.taskId.toString())
      expect(frontendPlan.title).toBe(backendPlan.taskName)
    }
  )
)
```

## Migration Guide

If you're updating existing code to use the new type system:

1. **Identify Backend vs Frontend Types**
   - API calls → use `backend-aligned.ts`
   - UI components → use `index.ts`

2. **Update Imports**

   ```typescript
   // Old
   import { StrategicTask } from '@/types'

   // New (for API calls)
   import { Plan } from '@/types/backend-aligned'

   // New (for UI)
   import { StrategicTask } from '@/types'
   ```

3. **Add Type Conversions**
   - Create converter functions for backend ↔ frontend type transformations
   - Place converters in `@/services/converters.ts`

4. **Update Tests**
   - Ensure tests use the correct types
   - Add property-based tests for type conversions

## Contributing

When adding new types:

1. **Determine the Type Category**
   - Backend entity → add to `backend-aligned.ts`
   - UI-specific → add to `index.ts`

2. **Follow Naming Conventions**
   - Backend types: Use backend field names (camelCase)
   - Frontend types: Use frontend terminology
   - Add JSDoc comments explaining the mapping

3. **Add Type Guards**
   - For discriminated unions
   - For API response validation

4. **Update This Documentation**
   - Add the new type to the appropriate section
   - Provide usage examples
   - Update the terminology mapping table if needed

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vue 3 TypeScript Guide](https://vuejs.org/guide/typescript/overview.html)
- Backend Schema: `sism-backend/database/migrations/V1.0__init.sql`
- Design Document: `.kiro/specs/frontend-optimization/design.md`
