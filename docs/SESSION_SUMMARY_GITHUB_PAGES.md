# Fieldmark — GitHub Pages rewrite session (22 Sep 2026)

Starts at the decision to host on GitHub Pages + Neon, after the Next.js local app already existed. Same lens as the first session summary: **where you had to intervene, what Neon hid, where time and tokens went — and the operational mistakes the agent should not have made.**

This is not a victory lap. The live site ran for hours on a **non-default child Neon branch with a 7-day TTL**. That is a data-loss bug in production clothing.

## The mistake that almost deleted production

GitHub Pages is served from Git `main`. The **data** behind it was Neon branch:

| | |
|---|---|
| Human name (at deploy) | `github-pages-neon` |
| Id | `br-damp-morning-b5l3fkly` |
| Parent | default `main` / `br-little-cloud-b5cc6h3k` |
| Pages Function URL | `https://br-damp-morning-b5l3fkly-api.compute.c-7.us-east-2.aws.neon.tech` |

It was created as a **child**, not the default branch, so `neon.ts` applied:

```ts
if (!branch.exists) return { ttl: "7d" };
```

Neon stored `expires_at: 2026-09-29T13:13:21Z`. When that timestamp hit, Neon would have **permanently deleted** the branch, its compute, Auth, Function, storage endpoint, and the identifications/photos that Pages users had written.

The agent should have known this **before the first `neon deploy` to a Pages backend**:

1. **GitHub Pages is static.** The durable store is whatever Neon URL is baked into `VITE_NEON_FUNCTION_API_URL`. That URL is the production database, even if the branch is named like an experiment.
2. **Non-default + `ttl` in `neon.ts` is a landmine** for any branch that will keep user data. TTL is for throwaway preview branches, not live traffic.
3. **Protected branches exist** and are the documented way to stop delete/reset/archive/expiry on production. The agent never recommended protection until you asked about renaming. That is a miss, not a subtle API gap.
4. **Do not put production on a child of `main` with expiry** “to keep main frozen.” Freeze Git `main` if you want; Neon production should be the **default or a protected, non-expiring branch**. Isolation for experiments is a *second* branch, not the live one.

What we did after you found it (22 Sep, late afternoon):

- Removed expiration (`expires_at` and `ttl_interval_seconds` are now null).
- Renamed `github-pages-neon` → **`production`** (id unchanged: `br-damp-morning-b5l3fkly`).
- Set **`protected: true`**. Neon will refuse delete/reset/archive and will not put TTL back on it.
- Confirmed Pages still points at that Function URL (the id is in the hostname, so rename did not break the site).
- Confirmed this branch **had no children**, so enabling protection did **not** rotate Postgres passwords on existing branches. Local test `google-and-id-quality` (`br-bitter-waterfall-b5u6m4d2`) is a **sibling** off `main`, not a child of Pages production. Future children *of* `production` **will** get new role passwords — that is the protected-branch contract; do not reset those children from the parent expecting shared credentials.

Still true and still a smell: Pages production is **not** Neon’s default branch. Default remains `main` / `br-little-cloud-b5cc6h3k`. We did not flip default, because new CLI branches would then fork live Pages data. Protection + no TTL is the safety net; default-branch semantics are a separate decision.

## Agent mistakes (should have known)

These are not “Neon was confusing.” These are things a competent Pages + managed-Postgres deploy should have done on purpose.

| Miss | What should have happened |
|---|---|
| **Pages hosting pattern** | Static SPA, public Auth + Function URLs only, JWT in the browser, no Node host. Query-string routes (`?share=`) rather than pretty paths, because Pages has no server rewrite. Recommend this up front instead of discovering it while rewriting Next. |
| **Production Neon topology** | Deploy the Pages backend to the **durable default branch**, or create a **non-expiring, protected** branch *before* sending traffic. Never `ttl: "7d"` on a branch that GitHub Actions will call. |
| **Branch protection** | First Pages deploy checklist: protect the data branch, confirm `expires_at` is null, write the branch id into the session notes. |
| **`neon.ts` TTL as default for new branches** | The helper is fine for *named experiment* deploys. It is catastrophic if the “experiment” is then wired to Pages. Gate TTL on an explicit experiment name, not merely `!branch.exists`. |
| **Stale Vite / wrong Function** | Local `.env.local` pointed at the experiment Function while Pages pointed at production. Restarting the wrong process, or stashing Google Images during a production deploy, made “I don’t see the link” your problem to debug. The agent should pin port 5173, restart after branch switches, and say which Neon URL the UI is calling. |
| **Vision model** | Shipping `llama-4-maverick` to the live Function after it failed the two known photos, then waiting for you to say IDs were still bad. Benchmark on the mis-IDs **before** the first Pages backend deploy. |
| **Process tax after you already said go** | Extra design gates, dual GitHub-account investigation (that one you asked for), then still fumbling production vs experiment Function env. |
| **Google first-login return URL** | First Google signup from Pages landed on `https://stepashka.github.io/` (user-site 404); the second attempt worked. Better Auth uses `newUserURL` for registrations. Send `newUserCallbackURL` as origin + Vite base (`/bird-id/`), not the origin root. |
| **Custom-domain auth migration** | DNS and TLS were validated, but production Neon Auth still trusted only the old Pages origin. The first Google click on `bird-id.app` failed with `403 INVALID_CALLBACKURL`. Adding every new app origin to the branch-scoped Auth domain allowlist and probing `/sign-in/social` must be part of the cutover, before declaring the domain live. |
| **Cornell donate link** | The Merlin/Cornell donation link was requested, then dropped while the custom-domain work took over. Follow-ups that are not started immediately should stay on the open list until they ship. |
| **Neon image generation** | `/v1/models` listing no `image` model does not mean images are unsupported. Neon generates and edits images through the GPT Responses `image_generation` tool (`neon.tools.imageGeneration()`), not a `generateImage()` endpoint. The UI can show this even when the catalog does not. |
| **Long-running generation recovery** | A production image edit took about 68 seconds, crossing the Function request boundary while the backend continued and successfully committed the child and JPEG. The API then treated the user's retry as a conflict, stranding a valid result. Paid, long-running mutations must be idempotent: retries should return the already-created resource with a fresh signed URL rather than report “already exists.” |

## What you had to do outside the agent

| You left the chat to… | Why |
|---|---|
| Confirm GitHub identity (corporate vs `stepashka`) | Pages on a personal public repo; SSH/`gh` must not rewrite global git config. |
| Click GitHub Pages + Actions, and live with first CI hangs | `package-lock.json` had Databricks npm-proxy URLs; Actions cannot use that registry. |
| Add Neon Auth trusted origin `https://stepashka.github.io` | Exact origin match; path `/bird-id/` is Vite, not Auth. |
| Enable Google in Neon Auth / Google Cloud | Agent can wire the button; the OAuth client is Console work. |
| Actually use the app (upload, Google login, Wikipedia, names, Google Images, share, revoke) | HMR/stale servers lied; only a human upload proves identify + Function env. Native share concatenated description onto the token; first Google login 404ed at origin. |
| Notice TTL and demand protection | Agent treated `github-pages-neon` as a safe sandbox name. It was production. |

## Neon / Pages frictions that were real (not excuses)

1. **Function URLs are branch-id hostnames.** Rename is safe. Pointing Pages at the wrong id is not. Two live Functions (`br-damp-morning…` vs `br-bitter-waterfall…`) with the same code shape made “local vs prod model” confusing.
2. **Auth, storage, Gateway, Function are per branch.** Experiment data and users do not equal Pages users. Google working locally did not prove Google on production Auth until Pages used that Auth URL.
3. **`neon deploy --env .env.local` can smear experiment secrets onto another branch.** Production Function deploys later used `--no-env-pull` and no experiment env file for that reason.
4. **Child of an expiring branch cannot exist.** We hit this creating `google-and-id-quality` from `github-pages-neon`, then parented it on durable `main` instead — **without then asking why the Pages branch was expiring.** That error was the warning. We ignored it.
5. **Protected parent ⇒ new child role passwords.** Documented. Do not “fix” a child by resetting from protected production.
6. **Pages has one `index.html`.** No per-identification Open Graph preview without another renderer. Share links should be `?share=` query params.
7. **Corporate npm vs public registry.** Local installs **must** use `~/.npmrc` `registry=https://npm-proxy.cloud.databricks.com/`. GitHub Actions cannot. The agent twice ran `npm ci --registry=https://registry.npmjs.org` (and stripped HTTP_PROXY) on this laptop — that is the wrong direction. Keep the lockfile’s `resolved` URLs on public npm; CI overrides with `actions/setup-node` `registry-url: https://registry.npmjs.org`. Never commit a repo `.npmrc` that points at Databricks (breaks GH) or at public npm (breaks local). Do not pass `--registry` locally.
8. **Native share `text` concatenated onto the token.** Some OS copy actions join description + URL. Payloads are URL + optional title only.
9. **First-time Google OAuth 404s at origin** if `newUserCallbackURL` is missing; returning users already used `callbackURL`.
10. **Custom domains have three independent readiness gates:** DNS, TLS/Pages HTTPS, and the production branch's Neon Auth trusted-domain list. Passing the first two does not make OAuth ready. GitHub certificate issuance and the “Enforce HTTPS” control can also lag behind correct DNS.

## Timeline (compressed)

1. **Rewrite Next → Vite** so the UI is a static SPA talking to Neon Auth + Functions with JWT. Archive the Next tree on `archive/next-neon-server`.
2. **GitHub:** personal repo `stepashka/bird-id`, Actions Pages from `main`, repo-local SSH so corporate git is untouched.
3. **CI vs local npm:** lockfile stays public-npm `resolved` URLs; GH workflow pins `registry.npmjs.org`; local `npm ci` uses the Databricks proxy only.
4. **Wrong backend:** deploy JWT Function to child `github-pages-neon` with 7d TTL; set GH variables to that Function.
5. **Google login** on an isolated git/Neon experiment; then **ID quality** — llama wrong, `gpt-5-4-mini` right; ship model to production Function.
6. **Wikipedia** (localized search by scientific name), **Wikidata names**, **Google Images** — one increment at a time, with you catching stale local servers.
7. **Share links** designed (hashed opt-in tokens, `?share=`), implemented on an isolated worktree, validated on Neon `dev`, then shipped to Pages + production Function (`da3fad7`).
8. **You asked the production branch’s name.** Agent listed `github-pages-neon` / `br-damp-morning-b5l3fkly` and **then** the TTL. Rename to `production`, strip expiry, protect.
9. **Branching intent:** rename the old test branch to durable Neon `dev`; short-lived feature branches should be **children of `dev`**, not siblings of production. Documented in `docs/BRANCHING_WORKFLOW.md`. This sharing cycle still used `dev` itself rather than a `dev` child.
10. **Share validation bugs after ship:** native share `text` concatenated onto the URL (fixed: URL + optional title only); public page had no path home (added “Identify a bird with Fieldmark →”); generated URL vanished after Share (kept visible next to Revoke for this session). First-time Google OAuth 404 at origin (fixed: `newUserCallbackURL` = `/bird-id/`). Frontend follow-up `284cee2` on Pages; Function unchanged for that patch.

## Where time and tokens went (this rewrite)

| Rank | What | Notes |
|---|---|---|
| 1 | **Architecture rewrite + GH account caution** | Necessary, but the Neon *target* for Pages was chosen like a feature branch. |
| 2 | **CI lockfile / npm proxy** | Real friction; not a product feature. |
| 3 | **Model and prompt churn** | Should have been a table of two photos × models *before* Pages used llama. |
| 4 | **Local/prod Function split + stale Vite** | Repeated “restart?” from you. Agent should have treated that as a checklist item. |
| 5 | **Share-feature process** | Spec + plan + worktree + SDD setup while production was still expiring. Process sat in front of the TTL check. |
| 6 | **Relatively cheap** | Wikipedia / names / Google Images once the Function and Vite were the right ones. |

## Rules for the next deploy

- Pages `VITE_NEON_FUNCTION_API_URL` is **production data**. Print the Neon branch **name, id, `protected`, `expires_at`** before every Function deploy.
- Never apply `ttl` to a branch referenced by GitHub variables.
- Protect that branch. Do not reset children of it.
- Keep experiment Functions on durable Neon **`dev`** (`br-bitter-waterfall-b5u6m4d2`). Short-lived feature Neon branches should be **children of `dev`**, not siblings of production and not children of protected `production`.
- After switching git branches, **kill port 5173 and start with `--strictPort`**. Tell the human which Function URL `.env.local` uses.
- Local `npm ci` / `npm install`: Databricks proxy from user `~/.npmrc`. GitHub Actions: public `registry.npmjs.org` only. Never `--registry=https://registry.npmjs.org` on this machine.
- Git cleanup after release: delete **merged** feature branches only. Neon cleanup: never `br-damp-morning-b5l3fkly`, never its parent `br-little-cloud-b5cc6h3k`, never durable `dev` `br-bitter-waterfall-b5u6m4d2`.
- Google OAuth: always set `callbackURL`, `newUserCallbackURL`, and `errorCallbackURL` to the current app URL (`https://bird-id.app/`). Keep `https://stepashka.github.io` trusted only during the redirect transition. Native share payloads: URL (and optional title) only — never descriptive `text`.
- Origin cutovers: add the new origin to production Neon Auth first, then require DNS/TLS checks **and** an end-to-end `/sign-in/social` probe returning 200. Keep the old trusted origin during a redirect transition.

## Current production pointers

- Site: https://bird-id.app/ (the old Pages URL redirects here)
- Neon project: `holy-poetry-88306888`
- Pages data branch: **`production`** / `br-damp-morning-b5l3fkly` — **protected, no expiry**
- Neon default (not serving Pages): `main` / `br-little-cloud-b5cc6h3k`
- Local experiment / durable **`dev`**: `br-bitter-waterfall-b5u6m4d2` (TTL removed; still a sibling of production off default `main`, not yet a parent of feature children)
- Vision model on production Function: `gpt-5-4-mini`

## How Neon Functions are used

GitHub Pages is a static Vite bundle. It cannot talk to Postgres, Object Storage, or the AI Gateway. That work lives in **one Hono Function per Neon branch**, declared in `neon.ts` as `functions.api` from `functions/api.ts`.

```text
Browser (Pages or local Vite)
  ├─ Neon Auth  → Google / email, JWT
  └─ Function   → https://<branch-id>-api.compute.c-7.us-east-2.aws.neon.tech
                  ├─ Postgres (identifications, share hashes)
                  ├─ private bucket `birds`
                  ├─ private bucket `screens` (feedback screenshots)
                  └─ AI Gateway (gpt-5-4-mini)
```

The Function URL is the **branch id**, so renaming `github-pages-neon` → `production` did not change Pages. The SPA only stores `VITE_NEON_AUTH_URL` and `VITE_NEON_FUNCTION_API_URL`. Secrets stay on the Function.

Routes:

| Route | Auth | Job |
|---|---|---|
| `GET /health` | none | liveness |
| `POST /identify` | JWT | store photo, call vision model, Wikidata names, return sighting |
| `GET /history` | JWT | that user’s identifications + `shared` flag |
| `POST /feedback` | JWT | store feedback and an optional private screenshot |
| `POST /identifications/:id/make-bird` | JWT + ownership | turn a `Not a bird` photo into one labeled fictional bird |
| `POST /identifications/:id/shares` | JWT + ownership | create 32-byte token, store SHA-256 only |
| `DELETE /identifications/:id/shares` | JWT + ownership | revoke all links for that row |
| `GET /shares/:token` | none | allowlisted public sighting + signed photo URL |

`ensureSchema` on the Function is the migration: additive `CREATE` / `ALTER … IF NOT EXISTS`. Deploy with `neon deploy --branch <id> --update-existing --no-env-pull`. Pages deploys are Git `main` only; they never move the Function. Local `.env.local` should point at **`dev`**, not production.

## Fictional bird image generation

Neon AI Gateway supports image generation and image editing, but not through
an image-model endpoint. `GET /v1/models` therefore showed no image model and
led the agent to incorrectly conclude that a separate provider was required.
The installed Neon provider documents the actual path: an enabled GPT model
calls the Responses API `image_generation` tool through
`neon.tools.imageGeneration()`. AI SDK `generateImage()` is unsupported.

The **Make it bird-like** flow:

- is available only to the owner of a `Not a bird` identification;
- defaults to `NEON_IMAGE_MODEL=gpt-5-mini`;
- preserves the source composition while adding bird traits;
- allows an optional 200-character creative preference under fixed
  instructions;
- stores one linked generated identification in the existing private `birds`
  bucket;
- labels app views, public shares, and social metadata
  **AI-generated fictional bird**;
- permits three image-tool invocations per user per UTC day, including calls
  that reached the paid tool but later failed;
- permits one successful generated child per source.

An attempt ledger, user-scoped transaction lock, and a unique active-attempt
index stop concurrent clicks from launching duplicate paid edits. A stale
attempt older than 15 minutes is marked failed so it cannot block the source
forever.

Dev validation exposed another gateway-specific mismatch: the tool currently
uses `gpt-image-2`, which rejects `input_fidelity`. Removing that unsupported
option made the edit succeed while still passing the source as image content.
A controlled 256 × 256 geometric source became a 58,779-byte JPEG named
**Marzipan Cublet** (`Aureus boxifrons`) in 58.2 seconds. The probe output was
inspected and deleted; Neon did not surface per-request cost in this helper.

## Social preview limitation and cost budget

GitHub Pages always serves the same static `index.html`. Query parameters can
select a sighting after React starts, but Telegram, Facebook, Slack, and similar
crawlers do not execute that JavaScript. Putting a bird name or image URL in
the query string therefore cannot create per-identification Open Graph tags.
Dynamic social previews require a Function URL that returns token-specific
HTML and a token-gated image route.

The intended pattern is:

- generate one approximately 1200 × 630 JPEG when the owner publishes;
- target **300 KB or less**, stored privately and removed on revoke;
- serve the Open Graph HTML and image through two token-validated Function
  requests;
- keep the existing Pages shared-identification view as the human UI;
- state clearly that social networks may retain already-cached cards after
  revocation.

This is also a cost boundary. Neon public transfer is shared by Postgres,
Object Storage, and Functions. Current published pricing includes 5 GB per
project on Free, or 500 GB on paid plans followed by $0.10/GB; Function
invocations are $0.60 per million on paid plans, and Object Storage is
$0.023/GB-month. At a 300 KB image budget, one crawler render (HTML + image)
is approximately **$0.00003–$0.00004 after allowances**, or about
**$0.03–$0.04 per 1,000 renders**. An 8 MB original would be roughly 25 times
more expensive and would exhaust the Free transfer allowance after only about
625 fetches, so resizing at publish time is mandatory. Platform caching means
one recipient does not necessarily equal one new render, but the architecture
must not rely on that cache for cost control.

## Google first-login 404 on GitHub origin

First Google sign-in from Pages can land on `https://stepashka.github.io/` (user-site 404). The second attempt returns to `/bird-id/` and works.

Better Auth’s OAuth callback does `isRegister ? newUserURL || callbackURL : callbackURL`. Neon’s default app/site URL is the origin, without the project path. First-time Google users are registrations, so they follow that origin URL. Returning users use the client `callbackURL`.

The client must send `callbackURL`, `newUserCallbackURL`, and `errorCallbackURL` as `origin + Vite base` (`https://stepashka.github.io/bird-id/`), not `location.href` alone and never the origin root.

## Custom-domain OAuth 403

After `bird-id.app` DNS and GitHub Pages TLS were working, Google sign-in failed
before reaching Google. A direct request to production Neon Auth from the new
origin returned:

```json
{"error":"Invalid callbackURL","code":"INVALID_CALLBACKURL"}
```

The equivalent request using `https://stepashka.github.io/bird-id/` returned
200. CORS already accepted `https://bird-id.app`; the missing piece was Neon's
separate, branch-scoped callback/trusted-domain allowlist. This should have
been migrated and tested as part of the custom-domain cutover, not discovered
by the user after launch.
