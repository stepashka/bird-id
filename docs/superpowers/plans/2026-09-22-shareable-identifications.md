# Shareable Identifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner create and revoke unguessable public links that show one bird identification and its photo.

**Architecture:** The Neon Function stores SHA-256 hashes of random share tokens and exposes one unauthenticated, allowlisted read route. The Vite app uses a GitHub Pages-safe `?share=` URL, renders shared records without Auth, and uses native sharing with a clipboard fallback.

**Tech Stack:** TypeScript, Hono, Node `crypto`, Postgres, React 19, Vite, Vitest, Neon Functions and Object Storage

**Spec:** `docs/superpowers/specs/2026-09-22-shareable-identifications-design.md`

## Global Constraints

- Existing identifications remain private until their owner presses **Share**.
- Tokens contain 32 random bytes, use base64url encoding, and are stored only as SHA-256 hashes.
- Public responses contain one identification and no owner or account fields.
- The public URL is `https://stepashka.github.io/bird-id/?share=<token>`.
- Invalid and revoked tokens return the same `404` response.
- Native sharing falls back to copying; failed copying leaves a manually copyable URL.
- External links on the shared page use `referrerPolicy="no-referrer"`.
- Production remains unchanged until isolated validation succeeds and the user separately approves deployment.

---

### Task 1: Token and public-response primitives

**Files:**
- Create: `lib/sharing.ts`
- Create: `lib/sharing.test.ts`

**Interfaces:**
- Produces: `createShareToken(): string`
- Produces: `hashShareToken(token: string): string`
- Produces: `isValidShareToken(token: string): boolean`
- Produces: `toPublicSighting(row: SharedIdentificationRow, photoUrl: string): PublicSighting`

- [ ] **Step 1: Write failing tests for tokens and field allowlisting**

```ts
import { describe, expect, it } from "vitest";
import {
  createShareToken,
  hashShareToken,
  isValidShareToken,
  toPublicSighting,
} from "./sharing";

describe("share tokens", () => {
  it("creates an unguessable base64url token", () => {
    const token = createShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isValidShareToken(token)).toBe(true);
  });

  it("hashes a token deterministically without retaining it", () => {
    const token = "a".repeat(43);
    expect(hashShareToken(token)).toHaveLength(64);
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toContain(token);
  });
});

it("allowlists fields returned by the public endpoint", () => {
  expect(
    toPublicSighting(
      {
        id: "bird-1",
        user_id: "private-user",
        object_key: "private/path.jpg",
        common_name: "European Goldfinch",
        scientific_name: "Carduelis carduelis",
        confidence: 0.96,
        created_at: new Date("2026-09-22T12:00:00Z"),
        common_names: { nl: "Putter" },
        alternatives: ["Eurasian Siskin"],
        evidence: ["red face", "yellow wing bar"],
      },
      "https://signed.example/photo",
    ),
  ).toEqual({
    id: "bird-1",
    commonName: "European Goldfinch",
    scientificName: "Carduelis carduelis",
    confidence: 0.96,
    createdAt: new Date("2026-09-22T12:00:00Z"),
    photoUrl: "https://signed.example/photo",
    names: { nl: "Putter" },
    alternatives: ["Eurasian Siskin"],
    evidence: ["red face", "yellow wing bar"],
  });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npm test -- lib/sharing.test.ts`

Expected: FAIL because `lib/sharing.ts` does not exist.

- [ ] **Step 3: Implement the primitives**

```ts
import { createHash, randomBytes } from "node:crypto";
import type { LocalizedNames } from "./bird-names";

export type SharedIdentificationRow = {
  id: string;
  user_id: string;
  object_key: string;
  common_name: string;
  scientific_name: string;
  confidence: number;
  created_at: Date;
  common_names: LocalizedNames | null;
  alternatives: string[] | null;
  evidence: string[] | null;
};

export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidShareToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function toPublicSighting(
  row: SharedIdentificationRow,
  photoUrl: string,
) {
  return {
    id: row.id,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    confidence: row.confidence,
    createdAt: row.created_at,
    photoUrl,
    names: row.common_names ?? {},
    alternatives: row.alternatives ?? [],
    evidence: row.evidence ?? [],
  };
}
```

- [ ] **Step 4: Run the focused and full tests**

Run: `npm test -- lib/sharing.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/sharing.ts lib/sharing.test.ts
git commit -m "Add secure sharing token primitives."
```

---

### Task 2: Sharing routes and Postgres persistence

**Files:**
- Create: `functions/share-routes.ts`
- Create: `functions/share-routes.test.ts`
- Modify: `functions/api.ts`

**Interfaces:**
- Consumes: `createShareToken`, `hashShareToken`, `isValidShareToken`, and `toPublicSighting` from Task 1
- Produces: `createShareRoutes(deps): Hono`
- Produces authenticated routes `POST /identifications/:id/shares` and `DELETE /identifications/:id/shares`
- Produces public route `GET /shares/:token`
- Adds `shared: boolean` to authenticated identification and history responses

- [ ] **Step 1: Write route tests with injected dependencies**

Create a `ShareRouteDependencies` interface whose methods are:

```ts
type ShareRouteDependencies = {
  resolveUserId(authorization: string | undefined): Promise<string>;
  createShare(input: {
    identificationId: string;
    userId: string;
    tokenHash: string;
  }): Promise<boolean>;
  revokeShares(input: {
    identificationId: string;
    userId: string;
  }): Promise<boolean>;
  findShared(tokenHash: string): Promise<SharedIdentificationRow | null>;
  signedPhotoUrl(objectKey: string): Promise<string>;
};
```

Test these behaviors through `app.request()`:

```ts
const sharedRow: SharedIdentificationRow = {
  id: "bird-1",
  user_id: "private-user",
  object_key: "private/photo.jpg",
  common_name: "European Goldfinch",
  scientific_name: "Carduelis carduelis",
  confidence: 0.96,
  created_at: new Date("2026-09-22T12:00:00Z"),
  common_names: { nl: "Putter" },
  alternatives: [],
  evidence: [],
};

function fakeDependencies(options: {
  createShareResult?: boolean;
  revokeSharesResult?: boolean;
  sharedRow?: SharedIdentificationRow | null;
} = {}): ShareRouteDependencies {
  return {
    resolveUserId: async () => "owner-1",
    createShare: async () => options.createShareResult ?? true,
    revokeShares: async () => options.revokeSharesResult ?? true,
    findShared: async () =>
      "sharedRow" in options ? (options.sharedRow ?? null) : sharedRow,
    signedPhotoUrl: async () => "https://signed.example/photo",
  };
}

it("does not create a share for another user's identification", async () => {
  const app = createShareRoutes(fakeDependencies({ createShareResult: false }));
  const response = await app.request("/identifications/bird-1/shares", {
    method: "POST",
    headers: { Authorization: "Bearer owner-jwt" },
  });
  expect(response.status).toBe(404);
});

it("returns the token after an owned share is created", async () => {
  const app = createShareRoutes(fakeDependencies({ createShareResult: true }));
  const response = await app.request("/identifications/bird-1/shares", {
    method: "POST",
    headers: { Authorization: "Bearer owner-jwt" },
  });
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

it("returns the same 404 for invalid and unknown tokens", async () => {
  const app = createShareRoutes(fakeDependencies({ sharedRow: null }));
  expect((await app.request("/shares/invalid")).status).toBe(404);
  expect(
    (await app.request(`/shares/${"a".repeat(43)}`)).status,
  ).toBe(404);
});

it("returns only the public sighting fields", async () => {
  const app = createShareRoutes(fakeDependencies({ sharedRow }));
  const response = await app.request(`/shares/${"a".repeat(43)}`);
  const body = await response.json();
  expect(body.userId).toBeUndefined();
  expect(body.objectKey).toBeUndefined();
  expect(body.commonName).toBe("European Goldfinch");
});

it("revokes only an identification owned by the caller", async () => {
  const app = createShareRoutes(fakeDependencies({ revokeSharesResult: false }));
  const response = await app.request("/identifications/bird-1/shares", {
    method: "DELETE",
    headers: { Authorization: "Bearer owner-jwt" },
  });
  expect(response.status).toBe(404);
});
```

- [ ] **Step 2: Run the route tests and confirm RED**

Run: `npm test -- functions/share-routes.test.ts`

Expected: FAIL because `createShareRoutes` does not exist.

- [ ] **Step 3: Implement the isolated Hono sub-app**

Implement `createShareRoutes(deps)` so:

- POST resolves the JWT user, creates a token and hash, calls
  `deps.createShare`, returns `404` when ownership fails, and otherwise returns
  `{ token }` with status `201`.
- DELETE resolves the JWT user, calls `deps.revokeShares`, returns `404` when
  ownership fails, and otherwise returns `{ ok: true }`.
- GET validates and hashes the token, calls `deps.findShared`, returns the same
  `{ error: "This shared identification is unavailable." }` `404` for malformed
  and missing tokens, signs the photo, and calls `toPublicSighting`.
- `AuthError` keeps its existing status; unexpected failures return `500`
  without including the token.

- [ ] **Step 4: Run route tests and confirm GREEN**

Run: `npm test -- functions/share-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Add the schema and production dependencies**

Extend `SCHEMA_SQL` in `functions/api.ts`:

```sql
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS alternatives jsonb;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS evidence jsonb;
CREATE TABLE IF NOT EXISTS identification_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identification_id uuid NOT NULL REFERENCES identifications(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identification_shares_identification_idx
  ON identification_shares (identification_id);
```

Implement dependencies with parameterized SQL:

```sql
INSERT INTO identification_shares (identification_id, token_hash)
SELECT id, $3
FROM identifications
WHERE id = $1 AND user_id = $2
RETURNING id;
```

```sql
DELETE FROM identification_shares shares
USING identifications identification
WHERE shares.identification_id = identification.id
  AND identification.id = $1
  AND identification.user_id = $2;
```

Before DELETE, query ownership so a valid owned record with zero shares remains
an idempotent success.

For public reads, join `identification_shares` to `identifications` by
`token_hash = $1`. Mount the sub-app with `app.route("/", shareRoutes)`.

Extend the identification insert and history query to write and read
`alternatives` and `evidence`. Older rows map null values to empty arrays.

Add `shared: false` to a newly created identification. Add this expression to
the history query and map it to the response:

```sql
EXISTS (
  SELECT 1 FROM identification_shares shares
  WHERE shares.identification_id = identifications.id
) AS shared
```

- [ ] **Step 6: Run backend and full verification**

Run: `npm test -- functions/share-routes.test.ts && npm test && npm run lint && npm run build`

Expected: PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 7: Commit**

```bash
git add functions/api.ts functions/share-routes.ts functions/share-routes.test.ts
git commit -m "Add secure public sharing endpoints."
```

---

### Task 3: Public API, share URLs, and browser sharing

**Files:**
- Modify: `src/lib/browser-api.ts`
- Modify: `src/lib/browser-api.test.ts`
- Create: `src/lib/share-link.ts`
- Create: `src/lib/share-link.test.ts`
- Modify: `src/lib/neon-auth.ts`
- Modify: `src/lib/sighting.ts`

**Interfaces:**
- Produces: `publicBirdApi.request<T>(path): Promise<T>` without Auth
- Produces: `readShareToken(search: string): string | null`
- Produces: `buildShareUrl(location, token): string`
- Produces: `shareLink(options): Promise<"shared" | "copied" | "manual" | "cancelled">`
- Adds `shared?: boolean` to `Sighting`

- [ ] **Step 1: Write failing public-client tests**

```ts
it("allows a public request without a JWT", async () => {
  const api = createPublicBirdApi({
    baseUrl: "https://function.example",
    fetcher: async () => Response.json({ id: "bird-1" }),
  });
  await expect(api.request("/shares/token")).resolves.toEqual({ id: "bird-1" });
});
```

The public client must reuse the existing JSON error parsing but never add an
`Authorization` header.

- [ ] **Step 2: Write failing URL and sharing tests**

```ts
expect(readShareToken("?share=abc")).toBe("abc");
expect(readShareToken("?other=abc")).toBeNull();
expect(
  buildShareUrl(
    { origin: "https://stepashka.github.io", pathname: "/bird-id/" },
    "abc",
  ),
).toBe("https://stepashka.github.io/bird-id/?share=abc");

it("uses native sharing when available", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  await expect(
    shareLink({ url: "https://example/share", share, writeText: vi.fn() }),
  ).resolves.toBe("shared");
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://example/share" }),
  );
});

it("copies when native sharing is unavailable", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  await expect(
    shareLink({ url: "https://example/share", writeText }),
  ).resolves.toBe("copied");
});
```

Also test `AbortError` returns `"cancelled"` and clipboard rejection returns
`"manual"`.

- [ ] **Step 3: Run both focused suites and confirm RED**

Run: `npm test -- src/lib/browser-api.test.ts src/lib/share-link.test.ts`

Expected: FAIL because the new interfaces do not exist.

- [ ] **Step 4: Implement the public client and sharing helpers**

Use `URLSearchParams` for parsing, `URL` for construction, injected browser
functions for testability, and no third-party dependency. Export
`publicBirdApi` from `src/lib/neon-auth.ts` using the same public Function URL.

- [ ] **Step 5: Add `shared?: boolean` to `Sighting` and run tests**

Run: `npm test -- src/lib/browser-api.test.ts src/lib/share-link.test.ts && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/browser-api.ts src/lib/browser-api.test.ts src/lib/share-link.ts src/lib/share-link.test.ts src/lib/neon-auth.ts src/lib/sighting.ts
git commit -m "Add browser support for public share links."
```

---

### Task 4: Owner share controls and public shared page

**Files:**
- Create: `src/components/share-controls.tsx`
- Create: `src/components/shared-identification-page.tsx`
- Create: `src/lib/shared-page.ts`
- Create: `src/lib/shared-page.test.ts`
- Modify: `src/components/sighting.tsx`
- Modify: `src/components/identify-panel.tsx`
- Modify: `src/components/history-panel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `birdApi`, `publicBirdApi`, `buildShareUrl`, `readShareToken`, and `shareLink`
- Produces: `ShareControls({ sighting, onSharedChange })`
- Produces: `SharedIdentificationPage({ token })`
- Adds optional `actions?: ReactNode` and `publicView?: boolean` to `SightingResult`

- [ ] **Step 1: Write component behavior tests**

Install no new test framework. Extract state transitions into exported helpers
in `src/lib/share-link.ts` and test them there:

```ts
expect(shareMessage("shared")).toBeNull();
expect(shareMessage("copied")).toBe("Link copied.");
expect(shareMessage("manual")).toBe("Copy this link:");
expect(shareMessage("cancelled")).toBeNull();
```

Test the shared-page loading decision in `src/lib/shared-page.test.ts`:

```ts
expect(sharedPageState({ loading: true })).toEqual({ kind: "loading" });
expect(sharedPageState({ error: true })).toEqual({ kind: "unavailable" });
expect(sharedPageState({ sighting })).toEqual({ kind: "ready", sighting });
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/lib/share-link.test.ts src/lib/shared-page.test.ts`

Expected: FAIL because `shareMessage` and `sharedPageState` do not exist.

- [ ] **Step 3: Implement `ShareControls`**

The component:

- POSTs `/identifications/${sighting.id}/shares`;
- builds the public URL from `window.location` and the returned token;
- calls `navigator.share` when available and clipboard otherwise;
- shows a manual text input containing the URL when both methods fail;
- updates `shared` to `true`;
- shows **Revoke shared links** when `shared` is true;
- DELETEs the same endpoint and updates `shared` to `false`;
- treats canceled native sharing as neither success nor error.

- [ ] **Step 4: Implement `SharedIdentificationPage`**

Fetch `/shares/${encodeURIComponent(token)}` with `publicBirdApi`. Render a
minimal Fieldmark heading and the existing `SightingResult`, but pass no owner
actions or private navigation. Show loading and unavailable states from the
spec.

Set `referrerPolicy="no-referrer"` on the bird photo, Wikipedia link, and
Google Images link when `SightingResult` receives `publicView`.

- [ ] **Step 5: Wire owner and public views**

Add an optional `actions` slot to `SightingResult`. `IdentifyPanel` and
`HistoryPanel` render `ShareControls` in that slot and update their local
sighting state after create/revoke.

At the top of `App`, read:

```ts
const shareToken = readShareToken(window.location.search);
if (shareToken) return <SharedIdentificationPage token={shareToken} />;
```

This branch must execute before `authClient.useSession()` so shared visitors
do not wait for or require Auth. Move the authenticated application into an
`AuthenticatedApp` child component to preserve React hook ordering.

- [ ] **Step 6: Run full verification**

Run: `npm test && npm run lint && npm run build`

Expected: PASS. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/share-controls.tsx src/components/shared-identification-page.tsx src/components/sighting.tsx src/components/identify-panel.tsx src/components/history-panel.tsx src/lib/share-link.ts src/lib/share-link.test.ts src/lib/shared-page.ts src/lib/shared-page.test.ts
git commit -m "Add share controls and public identification pages."
```

---

### Task 5: Isolated deployment and end-to-end validation

**Files:**
- Modify only if validation reveals a defect in files from Tasks 1–4.

**Interfaces:**
- Consumes the completed Function and Vite app.
- Produces a validated experiment ready for a separate production decision.

- [ ] **Step 1: Run repository verification from a clean tree**

Run:

```bash
npm test
npm run lint
npm run build
git status --short
```

Expected: all checks pass and the tree is clean.

- [ ] **Step 2: Deploy only to the experiment Neon branch**

Run:

```bash
NEON_AI_MODEL=gpt-5-4-mini npx neon@latest deploy \
  --project-id holy-poetry-88306888 \
  --branch br-bitter-waterfall-b5u6m4d2 \
  --update-existing \
  --no-env-pull
```

Expected: only `google-and-id-quality` (`br-bitter-waterfall-b5u6m4d2`) updates.

- [ ] **Step 3: Restart the local Vite server on a fixed port**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Expected: `http://127.0.0.1:5173/`.

- [ ] **Step 4: Validate the complete flow manually**

1. Sign in and identify a bird.
2. Press **Share** and confirm the native share sheet or clipboard fallback.
3. Open the generated URL in a private browser window.
4. Confirm the photo and bird fields load without signing in.
5. Confirm no account identity or history navigation appears.
6. Confirm Wikipedia and Google Images links work without sending the share
   token as a referrer.
7. Revoke links from the owner view.
8. Refresh the private window and confirm the neutral unavailable state.

- [ ] **Step 5: Stop for production approval**

Report the isolated Function URL, automated checks, and manual results. Do not
merge to `main`, deploy the production Neon branch, or push a Pages release
until the user explicitly approves production deployment.
