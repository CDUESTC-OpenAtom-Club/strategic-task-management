# Deprecated Backup Area

This directory is reserved for soft-deleted UI code and route providers.

## Policy

- Files placed here are backups, not active entry points.
- Code should remain readable and recoverable.
- Route or page consolidation must happen before moving code here.
- Do not import from this directory in new feature work unless explicitly restoring legacy behavior.

## Initial Scope

The first soft-delete batch targets:

- historical router providers
- duplicate page wrapper layers
- legacy indicator pages no longer needed as primary workbenches

## Current contents

- `2-pages/`
- `../1-app/providers/_deprecated/`
