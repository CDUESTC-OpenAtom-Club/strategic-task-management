# Legacy Indicator Module

## Status: ⚠️ DEPRECATED - COMPATIBILITY ONLY

**Archived on**: 2026-03-16
**Reason**: Replaced by modular `features/indicator` architecture
**Usage**: Public entrypoints now re-export from `features/indicator`

---

## Why Kept Temporarily?

This module contains legacy indicator components with complete business logic
but monolithic architecture. Its public entrypoints are now compatibility shells
that forward callers to the modular `features/indicator` module.

### Key Differences

| Aspect                | Legacy Module (This)              | Active Module (`features/indicator`) |
| --------------------- | --------------------------------- | ------------------------------------ |
| **Architecture**      | Monolithic (3-4K line components) | Modular (small focused components)   |
| **Code Organization** | Poor (mixed concerns)             | Clean (separated concerns)           |
| **Maintainability**   | Difficult                         | Easy                                 |
| **Import References** | **0** (unused)                    | **19** (production active)           |
| **Business Logic**    | ✅ Complete (100%)                | ❌ Incomplete (~10-20%)              |

---

## Critical Business Logic in This Module

**⚠️ DO NOT DELETE WITHOUT EXTRACTING FEATURES**

This module contains business logic that is **NOT present** in the active module:

### 1. College Distribution System

**File**: `ui/IndicatorDistributionView.vue` (3,893 lines)

**Features**:

- Dynamic college selection from database
- Child indicator creation from parent indicators
- Link child indicators to strategic tasks
- Auto-generate 12-month milestones for quantitative indicators
- Manual milestone management for qualitative indicators
- Batch distribute to multiple colleges
- College-specific indicator filtering
- Per-college status tracking

**Business Impact**: Core organizational hierarchy workflow - CANNOT be lost

---

### 2. Approval Workflow System

**Files**: `ui/IndicatorDistributionView.vue`, `ui/IndicatorListView.vue` (3,389 lines)

**Features**:

- Submit progress for approval
- Approve/reject submitted progress
- Multi-level approval chain (college → functional → strategic)
- Progress approval status management (PENDING/APPROVED/REJECTED)
- College-specific approval queues
- Pending approval count badges
- Approval history tracking (statusAudit)
- Separate lifecycle status from approval status
- Role-based approval permissions

**Business Impact**: Multi-level organizational approval process - CANNOT be lost

---

### 3. Milestone Intelligence

**Files**: `ui/IndicatorListView.vue`, `ui/IndicatorDistributionView.vue`

**Features**:

- Calculate milestone status (delayed/warning/ahead/normal)
- Detect overdue milestones
- Warn about upcoming milestones (5-day threshold)
- Show milestone progress tooltips
- Visual milestone timeline with completion status
- Validate milestone progress sequences
- Auto-generate monthly milestones
- Milestone CRUD operations with inline editing

**Business Impact**: Progress tracking and early warning system

---

### 4. Batch Operations

**Files**: Both components

**Features**:

- Batch distribute by task group
- Batch fill progress for multiple indicators
- Batch revoke distributed indicators
- Batch approve college submissions
- Batch reject with custom reasons
- Submit all indicators for approval
- Withdraw all approvals
- Task-grouped operations

**Business Impact**: User efficiency - significant productivity loss if removed

---

### 5. Advanced Status Management

**Files**: Both components

**Features**:

- Dual status system (lifecycle + approval)
- Distribution status (DRAFT/DISTRIBUTED/PENDING/APPROVED)
- Progress approval status (NONE/PENDING/APPROVED/REJECTED)
- Status validation with enum checks
- Safe status getters with fallbacks
- Status-based action enablement
- College-level status aggregation
- Status transition rules

**Business Impact**: Data integrity and workflow control

---

### 6. Progress Reporting

**File**: `ui/IndicatorListView.vue`

**Features**:

- Progress report dialog
- Nearest milestone calculation
- Progress submission with validation
- Report history tracking
- Visual progress indicators

**Business Impact**: Documentation and compliance

---

### 7. Role-Based Access Control

**Files**: Both components

**Features**:

- Strategic dept: full edit capabilities
- Functional dept: child indicator editing only
- Secondary college: view received indicators only
- Department-based data isolation
- Action visibility based on role
- Edit restrictions based on status

**Business Impact**: Security and permissions

---

## Migration Plan

See: `/docs/refactor-work-history.md` for detailed extraction plan.

### Extraction Priority

**Phase 1 (Week 1-2)**: Low-risk utilities

- Milestone calculation utilities
- Status management utilities
- Validation helpers

**Phase 2 (Week 3-4)**: Medium-risk features

- Batch operation composables
- Progress reporting components
- Status transition logic

**Phase 3 (Week 5-6)**: High-risk features

- College distribution workflow
- Approval workflow system
- Role-based access control

**Phase 4 (Week 7-8)**: Integration and cleanup

- Migrate pages to use new features
- Delete this legacy module
- Update documentation

---

## Component Details

### File Structure

```
legacy-indicator/
├── api/
│   └── indicatorApi.ts              # Basic API implementation (250 lines)
├── model/
│   ├── index.ts                     # Stub (6 lines)
│   └── store.ts                     # Stub store (38 lines)
└── ui/
    ├── IndicatorDetailDialog.vue    # Detail dialog (296 lines)
    ├── IndicatorDistributionView.vue # ⚠️ MASSIVE (3,893 lines) - All college distribution logic
    ├── IndicatorFillView.vue        # Fill form (222 lines)
    └── IndicatorListView.vue        # ⚠️ MASSIVE (3,389 lines) - All list + approval logic
```

### Dependencies

**Imports from**:

- `@/types` - Backend-aligned types
- `@/stores/strategic` - Strategic store
- `@/stores/auth` - Auth store
- `@/stores/timeContext` - Time context
- `@/stores/org` - Organization store
- `@/api/indicator` - Indicator API
- `@/components/task/*` - Task components
- `@/composables/useDataValidator` - Validation composable

**Used by**:

- **NONE** - 0 import references in entire codebase

---

## Technical Debt

### Architecture Issues

1. **Monolithic Components**
   - 3-4K line files
   - Mixed concerns (UI + business logic + state management)
   - Hard to test and maintain

2. **Tight Coupling**
   - Direct API calls (no abstraction)
   - Inline business logic
   - Hard-coded dependencies

3. **No Separation of Concerns**
   - UI components contain business logic
   - No clear layers
   - Difficult to reuse

### Code Quality

1. **No Type Safety**
   - Uses `@/types` instead of domain types
   - Missing type annotations in some places

2. **Limited Error Handling**
   - Basic try-catch
   - No error recovery
   - Limited user feedback

3. **No Testing**
   - No unit tests
   - No integration tests
   - Hard to test due to monolithic structure

---

## Next Steps

1. **DO NOT DELETE** until all features are extracted
2. **Reference this module** when implementing missing features in active module
3. **Extract incrementally** following the migration plan
4. **Test thoroughly** after each extraction
5. **Delete only when** active module has 100% feature parity

---

## Historical Context

**Original Purpose**: This was the first implementation of the indicator management system.
It was built quickly to meet business requirements, resulting in monolithic components.

**Why It Was Replaced**:

- Hard to maintain
- Difficult to add new features
- Poor code organization
- Lack of modularity

**Current Status**: Archived and preserved for feature extraction. No longer used in production.

---

## Contact

For questions about this module or the migration plan, see:

- `/docs/refactor-work-history.md` - Complete work history
- `/docs/day1-analysis-critical-findings.md` - Detailed analysis
- `/docs/day1-directory-reorganization-plan.md` - Reorganization plan
