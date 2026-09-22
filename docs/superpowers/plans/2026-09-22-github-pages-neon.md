# GitHub Pages + Neon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the server-rendered Next.js frontend with a static Vite React app that authenticates directly with Neon and calls the Neon Function with a user JWT.

**Architecture:** GitHub Pages serves only static assets. The browser uses Neon Managed Auth and forwards its short-lived JWT to the Neon Function. The Function verifies the JWT and owns Postgres, Storage, and AI Gateway access.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS 4, `@neondatabase/auth`, Neon Functions/Hono, Vitest, GitHub Actions Pages.

**Spec:** `docs/superpowers/specs/2026-09-22-github-pages-neon-design.md`

## Global Constraints

- Keep `main` unchanged at commit `6b02e09`.
- No secret may be bundled into the static frontend.
- The Function derives ownership only from a verified JWT `sub`.
- Preserve the existing Fieldmark visual design and upload/history behavior.
- GitHub Pages must work under a repository subpath.

---

### Task 1: Browser API boundary

**Files:**
- Create: `src/lib/browser-api.ts`
- Create: `src/lib/browser-api.test.ts`
- Modify: `functions/api.ts`
- Modify: `lib/auth.ts`
- Test: `src/lib/browser-api.test.ts`, `lib/auth.test.ts`

**Interfaces:**
- Consumes: `authClient.getJWTToken(): Promise<string | null>`
- Produces: `callBirdFunction<T>(path, init, getToken): Promise<T>`
- Produces: Function authorization based exclusively on JWT `sub`

- [ ] **Step 1: Write failing browser API tests**

```ts
it("adds the session JWT to Function requests", async () => {
  const fetcher = vi.fn(async () =>
    new Response(JSON.stringify({ items: [] }), { status: 200 }),
  );
  await callBirdFunction("/history", {}, async () => "jwt", fetcher);
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/history"),
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
    }),
  );
});

it("rejects when no JWT exists", async () => {
  await expect(
    callBirdFunction("/history", {}, async () => null),
  ).rejects.toThrow("Sign in");
});
```

- [ ] **Step 2: Run the tests and confirm missing-module failure**

Run: `npm test -- src/lib/browser-api.test.ts`

- [ ] **Step 3: Implement the browser API helper**

```ts
export async function callBirdFunction<T>(
  path: string,
  init: RequestInit,
  getToken: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error("Sign in to identify a bird.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetcher(`${FUNCTION_URL}${path}`, { ...init, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}
```

- [ ] **Step 4: Remove the shared-secret authorization branch**

Delete `FUNCTION_INVOKE_SECRET` / `X-User-Id` handling. Keep
`jwtVerify(token, jwks)` and return `payload.sub`.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- src/lib/browser-api.test.ts lib/auth.test.ts`
Expected: all pass.

### Task 2: Static Neon Auth client and UI

**Files:**
- Create: `src/lib/neon-auth.ts`
- Create: `src/components/auth-panel.tsx`
- Modify: `src/components/header.tsx`
- Modify: `src/components/identify-panel.tsx`
- Modify: `src/app/log/page.tsx` (move reusable log UI before Next removal)

**Interfaces:**
- Produces: `authClient` created with `BetterAuthReactAdapter()`
- Consumes: `authClient.useSession()`, `signIn.email`, `signUp.email`,
  `signOut`, `getJWTToken`

- [ ] **Step 1: Add a failing env-validation test**

Test that client configuration rejects a missing `VITE_NEON_AUTH_URL` and
`VITE_NEON_FUNCTION_API_URL` with a readable message.

- [ ] **Step 2: Install and configure browser Auth**

```ts
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
  adapter: BetterAuthReactAdapter(),
});
```

- [ ] **Step 3: Build email/password sign-in and sign-up**

Use controlled email/password/name fields. Surface Neon errors in the form;
never log credentials. Show sign-out when a session exists.

- [ ] **Step 4: Convert identify and history calls**

Replace `/api/identify` and `/api/history` with `callBirdFunction` and
`authClient.getJWTToken()`.

- [ ] **Step 5: Verify locally**

Run focused tests, then use the local browser to sign in, load history, and
submit a photo.

### Task 3: Replace Next with Vite SPA

**Files:**
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `vite.config.ts`
- Create: `src/vite-env.d.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Delete: `next.config.ts`, `src/proxy.ts`, `src/app/api/**`,
  `src/lib/auth/server.ts`, `src/lib/bird-api.ts`, Next auth/account pages

**Interfaces:**
- Consumes: auth panel, identify panel, log view
- Produces: static `dist/` output under configurable `base`

- [ ] **Step 1: Add a failing base-path test**

```ts
expect(normalizeBasePath("/bird-id")).toBe("/bird-id/");
expect(normalizeBasePath("/")).toBe("/");
```

- [ ] **Step 2: Install Vite and remove Next-only dependencies**

Keep React, Tailwind, Neon Auth UI, Vitest, and Function dependencies. Add
`vite` and `@vitejs/plugin-react`.

- [ ] **Step 3: Create the SPA shell**

Use an in-app `identify | log` view state. Render Auth inline. Preserve the
existing typography, palette, responsive layout, and error states.

- [ ] **Step 4: Configure Vite base path**

```ts
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 5: Run tests, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: `dist/index.html` exists and no Next server route remains.

### Task 4: GitHub Pages deployment

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes repository variables `VITE_NEON_AUTH_URL`,
  `VITE_NEON_FUNCTION_API_URL`
- Produces GitHub Pages deployment artifact `dist/`

- [ ] **Step 1: Add Pages workflow**

Use `actions/configure-pages`, `actions/upload-pages-artifact`, and
`actions/deploy-pages`. Build with:

```yaml
env:
  VITE_NEON_AUTH_URL: ${{ vars.VITE_NEON_AUTH_URL }}
  VITE_NEON_FUNCTION_API_URL: ${{ vars.VITE_NEON_FUNCTION_API_URL }}
  VITE_BASE_PATH: /${{ github.event.repository.name }}/
```

- [ ] **Step 2: Document repository setup**

Document Pages source “GitHub Actions,” the two repository variables, and how
to derive the Pages origin from the GitHub remote owner.

- [ ] **Step 3: Verify workflow syntax and local build**

Run the production build with a simulated `/bird-id/` base and inspect asset
URLs in `dist/index.html`.

### Task 5: Deploy Function auth change and end-to-end proof

**Files:**
- Modify: `neon.ts` (remove `FUNCTION_INVOKE_SECRET` env)
- Modify: `README.md`
- Modify: `docs/SESSION_SUMMARY.md`

**Interfaces:**
- Consumes browser JWT
- Produces deployed JWT-only Function

- [ ] **Step 1: Run Function auth tests**

Verify no shared-secret request succeeds and a valid JWT path remains covered.

- [ ] **Step 2: Deploy the Function**

Run: `npx neon@latest deploy --env .env.local`
Expected: function updated on the isolated `github-pages-neon` branch.

- [ ] **Step 3: Add the final Pages origin**

Run:

```bash
OWNER=$(git remote get-url origin | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#')
npx neon@latest neon-auth domain add "https://${OWNER}.github.io" \
  --project-id holy-poetry-88306888 \
  --branch br-damp-morning-b5l3fkly
```

- [ ] **Step 4: End-to-end browser verification**

On the Pages HTTPS URL: create/sign into an account, upload a real bird image,
confirm the result appears, refresh, open Log, and confirm the saved entry.

- [ ] **Step 5: Final verification and commit**

Run: `npm test && npm run lint && npm run build`.
Commit the finished branch without merging into `main`.
