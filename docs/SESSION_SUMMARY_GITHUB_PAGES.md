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

## What you had to do outside the agent

| You left the chat to… | Why |
|---|---|
| Confirm GitHub identity (corporate vs `stepashka`) | Pages on a personal public repo; SSH/`gh` must not rewrite global git config. |
| Click GitHub Pages + Actions, and live with first CI hangs | `package-lock.json` had Databricks npm-proxy URLs; Actions cannot use that registry. |
| Add Neon Auth trusted origin `https://stepashka.github.io` | Exact origin match; path `/bird-id/` is Vite, not Auth. |
| Enable Google in Neon Auth / Google Cloud | Agent can wire the button; the OAuth client is Console work. |
| Actually use the app (upload, Google login, Wikipedia, names, Google Images) | HMR/stale servers lied; only a human upload proves identify + Function env. |
| Notice TTL and demand protection | Agent treated `github-pages-neon` as a safe sandbox name. It was production. |

## Neon / Pages frictions that were real (not excuses)

1. **Function URLs are branch-id hostnames.** Rename is safe. Pointing Pages at the wrong id is not. Two live Functions (`br-damp-morning…` vs `br-bitter-waterfall…`) with the same code shape made “local vs prod model” confusing.
2. **Auth, storage, Gateway, Function are per branch.** Experiment data and users do not equal Pages users. Google working locally did not prove Google on production Auth until Pages used that Auth URL.
3. **`neon deploy --env .env.local` can smear experiment secrets onto another branch.** Production Function deploys later used `--no-env-pull` and no experiment env file for that reason.
4. **Child of an expiring branch cannot exist.** We hit this creating `google-and-id-quality` from `github-pages-neon`, then parented it on durable `main` instead — **without then asking why the Pages branch was expiring.** That error was the warning. We ignored it.
5. **Protected parent ⇒ new child role passwords.** Documented. Do not “fix” a child by resetting from protected production.
6. **Pages has one `index.html`.** No per-identification Open Graph preview without another renderer. Share links should be `?share=` query params.
7. **Corporate npm vs public registry.** Local installs **must** use `~/.npmrc` `registry=https://npm-proxy.cloud.databricks.com/`. GitHub Actions cannot. The agent twice ran `npm ci --registry=https://registry.npmjs.org` (and stripped HTTP_PROXY) on this laptop — that is the wrong direction. Keep the lockfile’s `resolved` URLs on public npm; CI overrides with `actions/setup-node` `registry-url: https://registry.npmjs.org`. Never commit a repo `.npmrc` that points at Databricks (breaks GH) or at public npm (breaks local). Do not pass `--registry` locally.

## Timeline (compressed)

1. **Rewrite Next → Vite** so the UI is a static SPA talking to Neon Auth + Functions with JWT. Archive the Next tree on `archive/next-neon-server`.
2. **GitHub:** personal repo `stepashka/bird-id`, Actions Pages from `main`, repo-local SSH so corporate git is untouched.
3. **CI vs local npm:** lockfile stays public-npm `resolved` URLs; GH workflow pins `registry.npmjs.org`; local `npm ci` uses the Databricks proxy only.
4. **Wrong backend:** deploy JWT Function to child `github-pages-neon` with 7d TTL; set GH variables to that Function.
5. **Google login** on an isolated git/Neon experiment; then **ID quality** — llama wrong, `gpt-5-4-mini` right; ship model to production Function.
6. **Wikipedia** (localized search by scientific name), **Wikidata names**, **Google Images** — one increment at a time, with you catching stale local servers.
7. **Share links** designed (hashed opt-in tokens, `?share=`) — implementation still on an isolated worktree, not production.
8. **You asked the production branch’s name.** Agent listed `github-pages-neon` / `br-damp-morning-b5l3fkly` and **then** the TTL. Rename to `production`, strip expiry, protect.

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
- Keep experiment Functions on a **sibling** branch (`google-and-id-quality` / `br-bitter-waterfall-b5u6m4d2` is the local test branch to preserve).
- After switching git branches, **kill port 5173 and start with `--strictPort`**. Tell the human which Function URL `.env.local` uses.
- Local `npm ci` / `npm install`: Databricks proxy from user `~/.npmrc`. GitHub Actions: public `registry.npmjs.org` only. Never `--registry=https://registry.npmjs.org` on this machine.
- Git cleanup after release: delete **merged** feature branches only. Neon cleanup: never `br-damp-morning-b5l3fkly`, never its parent `br-little-cloud-b5cc6h3k`, never `br-bitter-waterfall-b5u6m4d2`.

## Current production pointers

- Site: https://stepashka.github.io/bird-id/
- Neon project: `holy-poetry-88306888`
- Pages data branch: **`production`** / `br-damp-morning-b5l3fkly` — **protected, no expiry**
- Neon default (not serving Pages): `main` / `br-little-cloud-b5cc6h3k`
- Local experiment: `google-and-id-quality` / `br-bitter-waterfall-b5u6m4d2` (still has its own TTL — expected for a test branch)
- Vision model on production Function: `gpt-5-4-mini`

## Google first-login 404 on GitHub origin

First Google sign-in from Pages can land on `https://stepashka.github.io/` (user-site 404). The second attempt returns to `/bird-id/` and works.

Better Auth’s OAuth callback does `isRegister ? newUserURL || callbackURL : callbackURL`. Neon’s default app/site URL is the origin, without the project path. First-time Google users are registrations, so they follow that origin URL. Returning users use the client `callbackURL`.

The client must send `callbackURL`, `newUserCallbackURL`, and `errorCallbackURL` as `origin + Vite base` (`https://stepashka.github.io/bird-id/`), not `location.href` alone and never the origin root.
