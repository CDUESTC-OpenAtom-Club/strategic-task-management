# Entities Layer

The entities layer contains domain models that represent core business entities in the FSD (Feature-Sliced Design) architecture.

## Purpose

Entities are:
- **Domain models**: Represent fundamental business concepts
- **Shared across features**: Used by multiple features and pages
- **Type definitions**: Provide TypeScript interfaces and types
- **Business logic**: May contain domain-specific validation and methods

## Structure

```
entities/
├── indicator/          # Strategic indicator domain model
│   ├── model/
│   │   ├── types.ts   # Type definitions and interfaces
│   │   └── index.ts   # Model exports
│   └── index.ts       # Entity exports
├── plan/              # Strategic plan domain model
│   ├── model/
│   │   ├── types.ts   # Type definitions and interfaces
│   │   └── index.ts   # Model exports
│   └── index.ts       # Entity exports
└── index.ts           # Root exports
```

## Available Entities

### Indicator

Strategic performance indicators with hierarchical structure and workflow support.

**Key Types:**
- `Indicator` - Core indicator entity
- `IndicatorStatus` - Lifecycle status (DRAFT, PENDING_REVIEW, DISTRIBUTED, ARCHIVED)
- `IndicatorLevel` - Hierarchy level (FIRST, SECOND)
- `WorkflowStatus` - Workflow state tracking
- `ProgressApprovalStatus` - Progress approval states

**Usage:**
```typescript
import { Indicator, IndicatorStatus, IndicatorLevel } from '@/entities/indicator'

const indicator: Indicator = {
  id: 1,
  name: '年度学生满意度',
  status: IndicatorStatus.DRAFT,
  level: IndicatorLevel.FIRST,
  taskId: 10,
  ownerOrgId: 1,
  targetOrgId: 5,
  // ...
}
```

### Plan

Strategic performance plans that group indicators into assessment cycles.

**Key Types:**
- `StrategicPlan` - Core plan entity
- `PlanStatus` - Lifecycle status
- `PlanLevel` - Distribution level
- `AssessmentCycle` - Time period for assessment

**Usage:**
```typescript
import { StrategicPlan, PlanStatus, PlanLevel } from '@/entities/plan'

const plan: StrategicPlan = {
  id: 1,
  cycleId: 1,
  targetOrgId: 5,
  planLevel: PlanLevel.STRAT_TO_FUNC,
  status: PlanStatus.DRAFT,
  // ...
}
```

## Design Principles

### 1. Domain-Driven

Entities reflect the business domain, not technical implementation details.

### 2. Type Safety

All entities use TypeScript for compile-time type checking and IDE support.

### 3. Immutability

Entity types are designed to work with immutable data patterns.

### 4. Backend Alignment

Entity types match the backend Java entity structure for consistency.

### 5. No Dependencies

Entities should not depend on features, pages, or widgets. They are the foundation layer.

## Type Conventions

### Status Types

Use const objects with type unions for enum-like behavior:

```typescript
export type IndicatorStatus = 'DRAFT' | 'PENDING_REVIEW' | 'DISTRIBUTED' | 'ARCHIVED'

export const IndicatorStatus = {
  DRAFT: 'DRAFT' as const,
  PENDING_REVIEW: 'PENDING_REVIEW' as const,
  DISTRIBUTED: 'DISTRIBUTED' as const,
  ARCHIVED: 'ARCHIVED' as const
} as const
```

This provides:
- Type safety with string literal types
- Enum-like usage: `IndicatorStatus.DRAFT`
- Compatibility with `erasableSyntaxOnly` mode

### Optional Fields

Use `?` for optional fields that may not always be present:

```typescript
interface Indicator {
  id: number           // Required
  name: string         // Required
  description?: string // Optional
}
```

### Aliases

Provide aliases for fields with different names in frontend vs backend:

```typescript
interface Indicator {
  id: number
  indicatorId?: number  // Alias for id
  name: string
  indicatorDesc?: string // Alias for name
}
```

## Adding New Entities

1. Create entity directory: `entities/[entity-name]/`
2. Create model directory: `entities/[entity-name]/model/`
3. Define types: `entities/[entity-name]/model/types.ts`
4. Export model: `entities/[entity-name]/model/index.ts`
5. Export entity: `entities/[entity-name]/index.ts`
6. Add to root: `entities/index.ts`

## Related Documentation

- [FSD Architecture](../README.md)
- [API Documentation](../../../sism-backend/docs/API接口文档.md)
- [Backend Entities](../../../sism-backend/src/main/java/com/sism/entity/)
