# Milestone API Deduplication Report

**Date:** 2026-03-15  
**Status:** ✅ Completed  
**FSD Compliance:** Achieved

## Problem Summary

Found **THREE duplicate milestone API files** in the codebase, violating FSD architecture principles:

1. `/src/entities/milestone/api/milestoneApi.ts` - The source file (FSD-compliant)
2. `/src/features/milestone/api/milestoneApi.ts` - Duplicate #1 (incomplete, missing retry logic)
3. `/src/features/strategic-indicator/api/milestone.ts` - Duplicate #2 (additional createMilestone method)

## Analysis

### Source File (entities/milestone/api/milestoneApi.ts)

**Features:**

- ✅ Complete retry logic with `_withRetry` function
- ✅ Logger integration for debugging
- ✅ Correct import path: `@/shared/api/client`
- ✅ FSD-compliant location
- ❌ Missing `createMilestone` method (found in strategic-indicator version)

### Duplicate #1 (features/milestone/api/milestoneApi.ts)

**Issues:**

- ❌ No retry logic
- ❌ No logger integration
- ❌ Wrong import path: `@/shared/lib/api` (should be `@/shared/api/client`)
- ❌ Violates FSD principle - entities should own API definitions

### Duplicate #2 (features/strategic-indicator/api/milestone.ts)

**Issues:**

- ❌ Wrong import path: `@/shared/lib/api`
- ❌ Violates FSD principle - entities should own API definitions
- ✅ Had `createMilestone` method (missing from entities version)

### Current References (Before Fix)

```typescript
// src/shared/api/index.ts:68
export { milestoneApi } from '@/features/strategic-indicator/api/milestone'
```

## Changes Made

### 1. Enhanced Source File

**File:** `/src/entities/milestone/api/milestoneApi.ts`

**Change:** Added `createMilestone` method from strategic-indicator version

```typescript
export const milestoneApi = {
  /**
   * 创建新里程碑
   */
  async createMilestone(request: {
    indicatorId: number
    milestoneName: string
    targetProgress: number
    dueDate: string
    status: string
    sortOrder: number
  }): Promise<ApiResponse<Milestone>> {
    return apiClient.post<ApiResponse<Milestone>>('/milestones', request)
  }

  // ... rest of the methods
}
```

**Result:** ✅ Now contains ALL milestone API methods with proper retry logic and logging

### 2. Updated Shared API Export

**File:** `/src/shared/api/index.ts`

**Change:** Line 68 - Updated import to point to entities layer

```typescript
// BEFORE
export { milestoneApi } from '@/features/strategic-indicator/api/milestone'

// AFTER
export { milestoneApi } from '@/entities/milestone/api/milestoneApi'
```

**Result:** ✅ Backward compatibility maintained, now points to canonical source

### 3. Deprecated Duplicate Files

**File 1:** `/src/features/milestone/api/milestoneApi.ts`

**Change:** Replaced with deprecation notice and re-export

```typescript
/**
 * @deprecated This file has been moved to @/entities/milestone/api/milestoneApi.ts
 *
 * Please update your imports:
 * OLD: import { milestoneApi } from '@/features/milestone/api/milestoneApi'
 * NEW: import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
 *
 * Or use the shared API export: import { milestoneApi } from '@/shared/api'
 */

// Re-export from entities for backward compatibility
export { milestoneApi } from '@/entities/milestone/api/milestoneApi'
```

**File 2:** `/src/features/strategic-indicator/api/milestone.ts`

**Change:** Replaced with deprecation notice and re-export

```typescript
/**
 * @deprecated This file has been moved to @/entities/milestone/api/milestoneApi.ts
 *
 * Please update your imports:
 * OLD: import { milestoneApi } from '@/features/strategic-indicator/api/milestone'
 * NEW: import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
 *
 * Or use the shared API export: import { milestoneApi } from '@/shared/api'
 */

// Re-export from entities for backward compatibility
export { milestoneApi } from '@/entities/milestone/api/milestoneApi'
```

**Result:** ✅ Backward compatibility maintained, all old imports still work

## Verification

### TypeScript Type Check

```bash
npm run type-check
```

**Result:** ✅ No errors - TypeScript compilation successful

### Import References

All files now correctly reference the canonical source:

- ✅ `/src/shared/api/index.ts` → `/src/entities/milestone/api/milestoneApi.ts`
- ✅ `/src/features/milestone/api/milestoneApi.ts` → `/src/entities/milestone/api/milestoneApi.ts`
- ✅ `/src/features/strategic-indicator/api/milestone.ts` → `/src/entities/milestone/api/milestoneApi.ts`

### API Methods Coverage

The unified `milestoneApi` now includes:

1. ✅ `createMilestone` - Create new milestone
2. ✅ `getMilestonesByIndicator` - Get all milestones for an indicator
3. ✅ `getNextMilestoneToReport` - Get next milestone for reporting (catch-up rule)
4. ✅ `getUnpairedMilestones` - Get all unpaired milestones
5. ✅ `isMilestonePaired` - Check if milestone is paired
6. ✅ `getPairingStatus` - Get pairing status summary
7. ✅ `canReportOnMilestone` - Validate if milestone can be reported
8. ✅ `getMilestoneById` - Get milestone details
9. ✅ `validateWeights` - @deprecated (weight system replaced by targetProgress)

## Migration Guide

### For New Code

**Recommended:** Import from entities layer

```typescript
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
```

**Alternative:** Use shared API export

```typescript
import { milestoneApi } from '@/shared/api'
```

### For Existing Code

**No immediate action required** - All old imports continue to work due to re-exports.

**However, consider updating when convenient:**

```typescript
// OLD (deprecated but still works)
import { milestoneApi } from '@/features/milestone/api/milestoneApi'
import { milestoneApi } from '@/features/strategic-indicator/api/milestone'

// NEW (recommended)
import { milestoneApi } from '@/entities/milestone/api/milestoneApi'
// OR
import { milestoneApi } from '@/shared/api'
```

## Files Modified

| File                                                 | Type       | Change                                       |
| ---------------------------------------------------- | ---------- | -------------------------------------------- |
| `/src/entities/milestone/api/milestoneApi.ts`        | Enhanced   | Added `createMilestone` method               |
| `/src/shared/api/index.ts`                           | Updated    | Changed import path to entities layer        |
| `/src/features/milestone/api/milestoneApi.ts`        | Deprecated | Replaced with deprecation notice + re-export |
| `/src/features/strategic-indicator/api/milestone.ts` | Deprecated | Replaced with deprecation notice + re-export |

## FSD Architecture Compliance

### Before

```
❌ entities/milestone/api/milestoneApi.ts     (partial, missing createMilestone)
❌ features/milestone/api/milestoneApi.ts     (duplicate, missing retry logic)
❌ features/strategic-indicator/api/milestone.ts (duplicate, wrong location)
```

### After

```
✅ entities/milestone/api/milestoneApi.ts     (canonical source with all methods)
├── features/milestone/api/milestoneApi.ts     (re-export for backward compatibility)
└── features/strategic-indicator/api/milestone.ts (re-export for backward compatibility)
```

**Principles Satisfied:**

- ✅ **entities/** owns API definitions for domain entities
- ✅ **features/** can re-export from entities for backward compatibility
- ✅ Single source of truth for milestone API
- ✅ No code duplication (all methods in one place)
- ✅ Proper TypeScript types maintained
- ✅ Retry logic and logging preserved

## Next Steps

### Phase 1: Immediate (Completed)

- ✅ Consolidate API definitions to entities layer
- ✅ Update shared API exports
- ✅ Add deprecation notices to old files
- ✅ Verify TypeScript compilation

### Phase 2: Gradual Migration (Recommended)

- [ ] Update direct imports in feature-specific files to use entities layer
- [ ] Remove deprecation notices after migration complete
- [ ] Delete duplicate files (optional, keep for backward compatibility)

### Phase 3: Cleanup (Optional)

- [ ] Delete `/src/features/milestone/api/milestoneApi.ts` if no longer needed
- [ ] Delete `/src/features/strategic-indicator/api/milestone.ts` if no longer needed

## Conclusion

The Milestone API has been successfully deduplicated following FSD architecture principles. The canonical source is now located at `/src/entities/milestone/api/milestoneApi.ts` with all methods, proper retry logic, and logging. Backward compatibility is maintained through re-exports in the deprecated files.

**Status:** ✅ Ready for production  
**Breaking Changes:** ❌ None (backward compatible)  
**Type Safety:** ✅ Verified  
**FSD Compliance:** ✅ Achieved
