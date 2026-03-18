# UI Soft Delete Roadmap

## Purpose

This document records the current UI consolidation plan.
The goal is to reduce visible entry points without hard-deleting historical code.

## Core Entry Points To Keep

- `/dashboard`
- `/strategic-tasks`
- `/indicators`
- `/distribution`

These four routes are the only formal user-facing workbenches after consolidation.

## Soft Delete Rules

- Do not permanently delete historical views in this phase.
- Remove deprecated pages from active navigation first.
- Keep source files as backup implementations for later recovery.
- Prefer redirecting old routes to the primary workbench instead of serving duplicate pages.
- Add explicit documentation before moving or hiding code.

## Current Route Status

### Formal workbenches

- [router.ts](/Users/blackevil/Documents/前端架构测试/strategic-task-management/src/1-app/providers/router.ts)
- [useNavigation.ts](/Users/blackevil/Documents/前端架构测试/strategic-task-management/src/5-shared/lib/hooks/layout/useNavigation.ts)

### Historical or duplicate route providers

- [router-index.ts](/Users/blackevil/Documents/前端架构测试/strategic-task-management/src/1-app/providers/_deprecated/router-index.ts)
- [router-legacy.ts](/Users/blackevil/Documents/前端架构测试/strategic-task-management/src/1-app/providers/_deprecated/router-legacy.ts)

These files are not used by the running application. The active app entry imports `./providers/router`.

### Historical page wrappers

- [src/_deprecated/2-pages](/Users/blackevil/Documents/前端架构测试/strategic-task-management/src/_deprecated/2-pages)

This layer mostly wraps `3-features` views and is retained as backup code only.

## Consolidation Buckets

### Keep as formal entry

- `dashboard`
- `strategic-tasks`
- `indicators`
- `distribution`

### Keep, but only as internal capability

- `ApprovalProgressDrawer`
- `PlanApprovalDrawer`
- task and indicator detail drawers or dialogs

### Hide from formal IA, keep as backup

- `PlanListView`
- `PlanDetailView`
- `PlanEditView`
- `PlanAuditView`
- `PendingAuditView`
- `src/_deprecated/2-pages/**`
- `src/1-app/providers/_deprecated/router-index.ts`
- `src/1-app/providers/_deprecated/router-legacy.ts`
- `src/3-features/legacy-indicator/**`

## Execution Order

1. Mark unused route providers and historical wrappers as deprecated backup.
2. Keep active routing on `router.ts` only.
3. Remove duplicate pages from navigation and route discovery.
4. Replace old direct routes with redirects after the equivalent workbench flow is fully covered.
5. Move backup code into a dedicated deprecated namespace only after references are removed.

## Notes

- This is a soft-delete plan, not a hard deletion plan.
- Any later cleanup should preserve recovery paths and route mapping notes.
