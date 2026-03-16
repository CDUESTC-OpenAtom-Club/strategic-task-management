# ADR- Milestone Intelligence – Data Model Alignment and Adoption

Status: Proposed

Context
- The frontend milestone-related features exist in milestone-intelligence under
  src/shared/lib/milestone-intelligence with separate type definitions and UI
  components (MilestoneList.vue) that currently use a local Milestone shape
  (deadline field) while backend-aligned models use dueDate.
- There is an ongoing effort to unify milestone data representation to reduce
  duplicates and improve type safety across UI components and the milestone
  intelligence barrel exports.

Decision
- Introduce a canonical Milestone UI type (MilestoneUI) to unify milestone data
  consumption in the frontend. This type exposes fields that are stable across
  UI components: id, name, deadline, targetProgress, status, completed.
- Create a small data mapper milestoneDateNormalizer.ts to normalize milestone date
  fields across different shapes (deadline or dueDate) at data ingress points.
- Update milestoneTooltipBuilder to pull the canonical deadline via the new mapper
  instead of relying on disparate fields. This ensures tooltip data is built from
  a single source of truth for milestone dates.
- Begin migrating MilestoneList.vue to consume MilestoneUI from a shared type export
  instead of maintaining its own local Milestone interface. This reduces duplication
  and ensures behavior parity across UI layers.
- Extend the milestone-intelligence barrel to export getMilestonesTooltip and
  calculateMilestoneStatus, and plan to consume these in a dedicated Milestone view
  to consolidate logic and visuals in a single place.

Consequences
- Pros:
  - Reduced code duplication and better maintainability
  - Stronger type safety and clearer contracts around milestone data
  - Easier future refactors and new features around milestone calculations
- Cons:
  - Requires careful coordination to migrate all UI components to the new MilestoneUI
  - Backward compatibility logic may be necessary for a transition period

Next Steps
- Complete migration of MilestoneList.vue to MilestoneUI and remove local milestone
  interface definitions post-migration
- Add integration tests for milestone-intelligence path and tooltip generation
- Expand ADR to cover related data mapping decisions (e.g., policy on deadline field)
