# Fieldmark branching workflow

## Target shape

Fieldmark uses two durable Neon branches and short-lived feature branches:

```text
production (protected, no expiry, serves GitHub Pages)

dev (no expiry, seeded test data)
└── feature/<name> (7-day TTL, disposable)
```

Git and Neon branches have different jobs:

- Git `main` is the only branch deployed to GitHub Pages.
- Git feature branches and worktrees isolate code before merge.
- Neon `production` holds live Pages data and must never receive experimental deploys.
- Neon `dev` is a durable baseline with test users, photos, and identifications.
- Each feature gets a Neon child of `dev`. It may expire because it never serves Pages.

`production` and `dev` do not need to be parent and child. Their safety boundary
matters more than matching Git history. Feature branches should be children of
`dev`, not siblings of production's database lineage and not children of
protected production.

## How to get there

The existing `google-and-id-quality` branch
(`br-bitter-waterfall-b5u6m4d2`) becomes `dev`: remove its TTL, rename it, and
keep its current seeded users and sightings.

For each feature:

1. Create a Git feature branch in an isolated worktree.
2. Create a Neon child from `dev`, with a short TTL such as seven days.
3. Pull that child's environment into the worktree. A new child has its own
   branch credentials; never reuse production URLs or credentials.
4. Deploy Functions only to that feature branch and run the local Vite app
   against its Auth and Function URLs.
5. Validate tests and the full browser flow.
6. Ask before merging Git to `main` or deploying the Function/schema to
   `production`.
7. After production verification, delete the feature Git and Neon branches.

## Promotion is a deployment, not a branch swap

Do not point GitHub Pages at a feature branch. Merge reviewed code to Git
`main`, run additive/idempotent schema changes against Neon `production`, and
deploy the Function explicitly to `production`. Confirm the GitHub variables
still reference `br-damp-morning-b5l3fkly`.

Before every production deploy, verify:

- branch name: `production`;
- branch id: `br-damp-morning-b5l3fkly`;
- `protected: true`;
- `expires_at: null`;
- Pages Function URL contains that branch id.

## `neon.ts` guardrail

The current configuration gives every newly created non-default branch a
7-day TTL. That is suitable only when creation is explicit and the target is a
feature branch. A durable branch (`production` or `dev`) must already exist
with no expiration before deployment. Never wire GitHub Pages variables to a
branch created under the automatic TTL path.
