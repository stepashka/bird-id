# GitHub Pages + Neon design

## Goal

Host Fieldmark as a static GitHub Pages application while keeping all stateful work in Neon.

## Architecture

Replace the Next.js frontend with a Vite React SPA. The browser uses
`@neondatabase/auth` directly against the branch Auth URL and obtains a
short-lived JWT with `getJWTToken()`. It calls the existing Neon Function with
that JWT in `Authorization: Bearer <token>`.

The Neon Function remains the only component allowed to access Postgres,
Object Storage, and AI Gateway credentials. It verifies the JWT against
`NEON_AUTH_JWKS_URL`, derives `user_id` from `sub`, and never accepts a
browser-supplied user id.

```text
GitHub Pages (static React)
  ├─ sign in/up ────────────────> Neon Managed Auth
  └─ photo/history + Bearer JWT -> Neon Function
                                      ├─ Postgres
                                      ├─ Object Storage
                                      └─ AI Gateway
```

## Security boundary

The static bundle may contain only public service URLs:

- `VITE_NEON_AUTH_URL`
- `VITE_NEON_FUNCTION_API_URL`

It must not contain database credentials, storage credentials, AI Gateway
credentials, `NEON_AUTH_COOKIE_SECRET`, or `FUNCTION_INVOKE_SECRET`.

The Function accepts only a valid Neon Auth JWT. CORS allows the deployed
GitHub Pages origin and localhost development origins. Neon Auth must also
trust the exact GitHub Pages origin.

## UI

Preserve the existing Fieldmark visual design and the two primary flows:

1. Sign in or create an account with email/password.
2. Upload one JPEG, PNG, or WebP photo and show the identification.
3. View the authenticated user's identification log.
4. Sign out.

Use a simple client-side view switch instead of server routing so GitHub Pages
does not need SPA fallback rewrites.

## Deployment

Vite builds to `dist/` with a repository-relative base path. A GitHub Actions
workflow uploads `dist/` and deploys it with GitHub Pages.

The workflow reads the two public URLs from GitHub repository variables.
After the first Pages URL is known, add its origin to Neon Auth trusted
domains and the Function CORS allowlist.

## Validation

- Unit-test API calls for JWT attachment and unauthenticated failure.
- Unit-test base-path construction.
- Keep existing image and model-output tests.
- Run tests, lint, and Vite production build.
- Locally verify sign-up/sign-in, JWT retrieval, Function history, upload,
  and log.
- After GitHub Pages deploy, repeat the browser flow on the HTTPS origin.

## Rollback

The current Next.js implementation remains unchanged on `main` at commit
`6b02e09`. The rewrite exists only on `feat/github-pages-neon`.
