# Indicator Module Differential Report

**Generated:** 2026-03-15
**Branch:** refactor/phase1-emergency-fixes
**Task:** Merge `features/indicator` and `features/strategic-indicator`

---

## Executive Summary

After comprehensive analysis, I found that **most of the codebase already uses `features/strategic-indicator`**. The old `features/indicator` module contains some UI components that need to be migrated, but the core API and business logic are already in the strategic-indicator module.

**Recommendation:** Keep `features/strategic-indicator` as the primary module and migrate unique components from `features/indicator`.

---

## File Structure Comparison

### features/indicator/ (9 files)
```
indicator/
├── api/
│   └── indicatorApi.ts        ✅ Complete with retry logic
├── model/
│   ├── index.ts               ⚠️  Basic exports
│   └── store.ts               ⚠️  Minimal store implementation
├── ui/
│   ├── index.ts               ⚠️  Component exports
│   ├── IndicatorDetailDialog.vue   ❌ NOT in strategic-indicator
│   ├── IndicatorDistributionView.vue ❌ Similar to strategic-indicator/IndicatorDistributionDialog.vue
│   ├── IndicatorFillView.vue        ❌ NOT in strategic-indicator
│   └── IndicatorListView.vue        ❌ Similar to strategic-indicator/IndicatorList.vue
└── index.ts                   ⚠️  Public API exports
```

### features/strategic-indicator/ (20+ files)
```
strategic-indicator/
├── api/
│   ├── index.ts               ✅ Consolidated API exports
│   ├── indicator.ts           ✅ Complete with retry logic & withdrawal
│   ├── milestone.ts           ✅ Milestone operations
│   ├── query.ts               ✅ Query separation
│   ├── mutations.ts           ✅ Mutation separation
│   └── types.ts               ✅ API types
├── model/
│   ├── store.ts               ✅ Comprehensive store
│   ├── types.ts               ✅ Business types
│   ├── schema.ts              ✅ Zod validation schemas
│   └── constants.ts           ✅ Configuration constants
├── lib/
│   ├── calculations.ts        ✅ Business calculations
│   └── validations.ts         ✅ Business validations
├── ui/
│   ├── IndicatorCard.vue      ✅ Card component
│   ├── IndicatorForm.vue      ✅ Form component
│   ├── IndicatorList.vue      ✅ List component (better structure)
│   └── IndicatorDistributionDialog.vue ✅ Distribution dialog
├── index.ts                   ✅ Comprehensive public API
└── README.md                  ✅ Well documented
```

---

## API Layer Analysis

### indicator/api/indicatorApi.ts vs strategic-indicator/api/indicator.ts

**Similarities:**
- Both implement `withRetry` helper function (identical implementation)
- Both provide same core CRUD operations
- Both handle distribution operations
- Both import types from `@/shared/api/types/backend-aligned`

**Differences:**
| Feature | indicator | strategic-indicator | Winner |
|---------|-----------|---------------------|---------|
| Basic CRUD | ✅ | ✅ | Tie |
| Distribution | ✅ | ✅ | Tie |
| Retry Logic | ✅ | ✅ | Tie |
| **Withdrawal** | ❌ | ✅ | **strategic-indicator** |
| **Review Workflow** | ❌ | ✅ | **strategic-indicator** |
| **API Organization** | Single file | Split (query/mutations) | **strategic-indicator** |
| **Milestone API** | Separate file | Integrated | **strategic-indicator** |

**Winner:** `strategic-indicator` - More comprehensive with withdrawal and review workflow features.

---

## UI Components Analysis

### Unique Components in features/indicator:

1. **IndicatorDetailDialog.vue** - NOT in strategic-indicator
2. **IndicatorFillView.vue** - NOT in strategic-indicator (form for filling indicator progress)
3. **IndicatorDistributionView.vue** - Similar to IndicatorDistributionDialog.vue but different implementation

### Components in strategic-indicator:
1. **IndicatorCard.vue** - NOT in indicator
2. **IndicatorForm.vue** - NOT in indicator
3. **IndicatorList.vue** - Better structured than IndicatorListView.vue
4. **IndicatorDistributionDialog.vue** - Similar functionality to IndicatorDistributionView.vue

**Comparison: IndicatorListView.vue vs IndicatorList.vue**

| Aspect | IndicatorListView (indicator) | IndicatorList (strategic) | Winner |
|--------|-------------------------------|---------------------------|---------|
| Props Structure | ❌ No clear interface | ✅ Well-defined Props interface | **strategic** |
| TypeScript | ⚠️  Mixed types | ✅ Strong typing | **strategic** |
| Component Design | ❌ Monolithic (398+ lines) | ✅ Modular (50 lines) | **strategic** |
| Event Handling | ⚠️  Basic | ✅ Clear emit interface | **strategic** |
| Dependencies | ❌ Many direct imports | ✅ Feature-scoped imports | **strategic** |

**Winner:** `strategic-indicator` - Better architecture, cleaner code.

---

## Business Logic Analysis

### features/indicator:
- **No dedicated business logic layer**
- Logic embedded in components
- Basic store with placeholder implementation

### features/strategic-indicator:
- **Rich business logic in lib/calculations.ts:**
  - `calculateCompletionRate()`
  - `calculateWeightedCompletionRate()`
  - `validateWeightSum()`
  - `calculateProgress()`
  - `formatWeightAsPercentage()`
  - `calculateAggregateStatistics()`
- **Comprehensive validations in lib/validations.ts:**
  - Permission checks (`canEditIndicator`, `canDeleteIndicator`, etc.)
  - Data validation (`validateIndicatorCreate`, `validateIndicatorUpdate`, etc.)
  - Action availability (`getAvailableActions`)

**Winner:** `strategic-indicator` - Far superior business logic separation.

---

## Type Safety Analysis

### features/indicator:
- ⚠️ Uses mixed types from `@/types` and local definitions
- ⚠️ Some eslint-disable comments for type restrictions
- ⚠️ Less consistent type imports

### features/strategic-indicator:
- ✅ Centralized types in `model/types.ts`
- ✅ Schema validation with Zod in `model/schema.ts`
- ✅ Clear separation between API types and business types
- ✅ Consistent use of backend-aligned types

**Winner:** `strategic-indicator` - Better type organization.

---

## Current Usage Analysis

### Files using @/features/indicator:
**Only 1 file found:**
- `src/pages/README.md` (Line 32) - Documentation example code

### Files using @/features/strategic-indicator:
**17 active files:**
- `src/pages/strategy/indicators/ui/IndicatorEditPage.vue`
- `src/pages/strategy/indicators/ui/IndicatorDetailPage.vue`
- `src/pages/strategy/indicators/ui/IndicatorDistributePage.vue`
- `src/pages/strategy/tasks/ui/StrategicTaskPage.vue`
- `src/features/task/model/strategic.ts`
- `src/shared/api/index.ts`
- Multiple test files

**Conclusion:** The codebase has already migrated to strategic-indicator. Only documentation examples reference the old module.

---

## Migration Strategy

### Phase 1: Migrate Unique Components (Day 2)

**Components to migrate from indicator to strategic-indicator:**

1. **IndicatorDetailDialog.vue**
   - Copy to `strategic-indicator/ui/`
   - Update imports
   - Test functionality

2. **IndicatorFillView.vue**
   - Copy to `strategic-indicator/ui/`
   - Update imports
   - Test functionality

3. **IndicatorDistributionView.vue**
   - Compare with IndicatorDistributionDialog.vue
   - Merge unique features
   - Keep better implementation

### Phase 2: Update Exports (Day 2)

**Update strategic-indicator/index.ts to include:**
```typescript
// Migrated components
export { default as IndicatorDetailDialog } from './ui/IndicatorDetailDialog.vue'
export { default as IndicatorFillView } from './ui/IndicatorFillView.vue'
```

### Phase 3: Update References (Day 3)

**Files to update:**
- `src/pages/README.md` - Update example code

### Phase 4: Cleanup (Day 3)

**Remove:**
- `features/indicator/` directory entirely
- Update any remaining imports
- Run tests to verify

---

## Risk Assessment

### Low Risk Items:
- ✅ API layer - Already identical in strategic-indicator
- ✅ Business logic - Superior in strategic-indicator
- ✅ Most UI components - Better in strategic-indicator

### Medium Risk Items:
- ⚠️  IndicatorDetailDialog.vue - Needs migration and testing
- ⚠️  IndicatorFillView.vue - Needs migration and testing
- ⚠️  Component prop compatibility - May need adjustments

### Mitigation Strategies:
1. **Backup branch:** Already created as safety net
2. **Incremental migration:** Migrate one component at a time
3. **Testing:** Run tests after each component migration
4. **Rollback plan:** Keep backup branch until verification complete

---

## Testing Checklist

### After Migration:
- [ ] Type checking passes: `npm run type-check`
- [ ] Unit tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] No import errors for indicator module
- [ ] Manual testing:
  - [ ] Indicator list loads
  - [ ] Indicator detail view works
  - [ ] Indicator form submission works
  - [ ] Indicator distribution works
  - [ ] Progress filling works (IndicatorFillView)

---

## Recommendations

### Immediate Actions (Day 2):
1. ✅ Keep `strategic-indicator` as primary module
2. ✅ Migrate `IndicatorDetailDialog.vue`
3. ✅ Migrate `IndicatorFillView.vue`
4. ✅ Compare and merge `IndicatorDistributionView.vue` features

### Follow-up Actions (Day 3):
1. ✅ Update documentation in `src/pages/README.md`
2. ✅ Delete `features/indicator` directory
3. ✅ Run comprehensive test suite
4. ✅ Manual UI testing

### Long-term Improvements:
1. Consider renaming `strategic-indicator` to `indicator` after migration stabilizes
2. Document component props and events more thoroughly
3. Add integration tests for indicator workflows
4. Consider splitting large components further

---

## Conclusion

The merger is straightforward since **strategic-indicator is already the de facto standard** in the codebase. The main work is:

1. **Migrating 2 unique UI components** from the old module
2. **Updating 1 documentation file**
3. **Deleting the old module**

The strategic-indicator module is superior in every aspect:
- Better architecture (FSD compliant)
- More comprehensive features
- Better type safety
- Richer business logic
- Better documentation

**Estimated Effort:** 2-3 hours for migration, 1-2 hours for testing
**Risk Level:** Low (most code already uses strategic-indicator)
**Confidence Level:** High (clear path forward, minimal unknowns)

---

**Report Status:** ✅ Complete
**Next Step:** Proceed with Day 2 - Execute Merger
