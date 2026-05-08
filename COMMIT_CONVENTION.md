# Commit Convention

## Branch policy

- `main`: stable production branch
- `baseline/*`: active baseline branch for ongoing verified work
- temporary branches such as `codex/*`, `actions-test-*`, `backup/*`, `feature/*`, `fix/*`: delete after validation or migration

## Commit message format

Use:

```text
<type>: <summary>
```

Examples:

```text
feat: add frontend image build workflow
fix: align nginx proxy behavior for podman deployment
chore: remove obsolete remote validation branches
docs: add commit convention for baseline workflow
```

## Allowed types

- `feat`: new feature or user-visible capability
- `fix`: bug fix or regression repair
- `refactor`: structural code change without intended behavior change
- `chore`: tooling, workflow, cleanup, branch governance
- `docs`: documentation only
- `test`: test-only change
- `perf`: performance improvement
- `ci`: CI/CD workflow change

## Rules

- Keep the summary on one line.
- Use the imperative mood.
- Describe the actual change, not the intention.
- Split unrelated changes into separate commits.
- UI changes and deployment workflow changes should be committed separately when practical.

## Baseline workflow

- New ongoing validated work should target the retained `baseline/*` branch instead of creating long-lived ad hoc branches.
- Before deleting a temporary remote branch, make sure any required commits are already preserved in `baseline/*` or `main`.
