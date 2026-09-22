# Fieldmark (bird-id) — Session summary

A bird-photo ID app with per-user history, built in this session on Neon’s backend (Postgres, Managed Auth, Object Storage, Functions, AI Gateway) plus a local Next.js UI.

This write-up is intentionally from one lens: **where you had to leave the chat, what Neon hid, where time went, and where tokens burned.**

## What you actually had to do outside this session

The agent could not finish “just in chat.” You repeatedly left the IDE and came back with a URL, a click, or an error string.

| You left the session to… | Why the agent couldn’t do it |
|---|---|
| Complete **Neon OAuth in the browser** (`oauth2.neon.tech`) | `neon login` always opens a browser. No token in chat. |
| Pick an **org** (Yanic vs several “Anna” orgs) | CLI listed orgs interactively; linking is an account decision. |
| Paste the **exact Console URL** for `Bird_app` (`little-haze-77147891` / `br-icy-block-b4dsjzl7`) | Agent could list projects, not know which one you meant. |
| **Use the running app** (sign in, upload, copy error text) | “Invalid origin”, “backend not linked”, “AI gateway not enabled” only showed up in the browser. |
| Deal with **AI Gateway entitlement** | Not a code flag. First org returned 403 with every model `enabled: false`. You asked how to turn it on; the real lever is Console billing / a different org. |
| **Create a new account** after we moved projects | Neon Auth is per branch. New project = empty user table. Old login does not carry over. |
| (Still pending for “on the web”) **GitHub + Vercel + trusted domain** | Frontend hosting is not Neon. You also have to add the public origin in Neon Auth. |

Anything that looked like “the agent deployed Neon” still needed **your approval** on deploy / auth-domain changes, plus those browser steps.

## Neon frictions that were not obvious

These are the ones that cost real time because docs/marketing and runtime disagree, or because a missing piece looks like a totally different error.

1. **`neon.ts` is not the backend until `neon deploy`.** `neon link` pins a project and then *fails env pull* with “your neon.ts declares X but the branch does not have it yet.” The file is a wish list; deploy is the provisioner.

2. **Several secrets Neon does not inject.** `DATABASE_URL`, Auth URLs, AWS_*, Gateway token, Function URL *are* pulled. **`NEON_AUTH_COOKIE_SECRET` and our `FUNCTION_INVOKE_SECRET` are not.** Empty invoke secret surfaced as a **503 “Neon backend is not linked yet”** — a lie. The backend *was* linked; the app invented that message when the secret was missing. Function `env` in `neon.ts` is also **bake-at-deploy** (`process.env` when you run deploy), not live runtime.

3. **Auth “Invalid origin” is exact-match and IP-hostile.** `allow-localhost` allows `http://localhost:3000`, **not** `http://127.0.0.1:3000`. The agent had bound Next to the IP (sandbox `networkInterfaces` bug). Sign-up 403 until we added the IP as a trusted domain. Empty trusted-domain list on a new branch is the default.

4. **“AI Gateway is GA” ≠ this account can call models.** Gateway host + token can 200 on `/v1/models` while **every row is `enabled: false`**, and chat completions 403 `ai gateway not enabled for account`. GA docs still require a **paid plan + prepaid credits**. Open-weight models and frontier GPT/Gemini are separate gates. We “fixed” this by **changing orgs**, not by flipping a CLI switch.

5. **Catalog vs vision.** After the org switch, 11 models were enabled, all labeled `text` input. **`llama-4-maverick` still accepted an image** (pixel test → `"Black."`). Trusting the catalog alone would have looked like “no vision model.”

6. **Region lock.** Functions / Storage / Gateway need specific AWS regions (`us-east-2` was the safe default). Postgres + Auth work more broadly. Easy to create a project in the wrong region and only fail later.

7. **Branch-scoped everything.** New project/branch = new Auth users, new bucket, new Function URL, new Gateway credential. Moving orgs meant a **new signup**, not a config edit.

8. **CLI tax.** Almost every `npx neon@latest …` re-downloaded the CLI (~10–25s of noise per command). Org list is interactive unless you pass `--org-id`.

9. **`files-sdk` as “the Neon way.”** Neon’s own storage docs point at `files-sdk`, whose optional peers pulled Azure, GCP, Svelte, Playwright, etc. through a slow npm proxy. Multi-minute installs, 0 packages written while resolving. Real fix: AWS S3 client + `forcePathStyle`.

## Where time went (especially Neon)

Rough order of cost, not clock-perfect:

| Rank | What | Why it was expensive |
|---|---|---|
| 1 | **Getting a working identify call** | Three sequential Neon product bugs/gotchas (origin → invoke secret → Gateway entitlement), each looking like “the app is broken,” each requiring a browser round-trip from you. |
| 2 | **npm / `files-sdk`** | Long silent installs, aborted jobs, proxy in `eu-west-1`. Little product value. |
| 3 | **Design ceremony vs “just build”** | Architecture questions + a second approval after you already said go. |
| 4 | **Docs vs runtime** | Fetching Neon GA/Auth/Gateway/Functions pages, then discovering cookie secret, origins, plan gates, and `enabled: false` only by probing. |
| 5 | **Local Next + Neon Auth glue** | Next 16 peer on `@neondatabase/auth`, `proxy.ts` vs middleware, cookie secret required at **build** time, home page 307 until matcher was narrowed. |
| 6 | **Org/project shuffle** | First project (Yanic `Bird_app`) was the right *shape* (us-east-2) but the wrong *entitlement*. Second project (`holy-poetry-88306888` in `org-shy-forest`) is where Gateway actually ran. |

The app itself (upload UI, schema, function handlers) was not the long pole. **Neon product seams were.**

## Where tokens burned

Largest burns, in practice:

1. **Pre-implementation.** Brainstorming skill, one-question-at-a-time product design, then a second “approve the design” after you said build. High tokens, zero running app.
2. **Neon documentation ingestion.** Multiple full doc fetches (backend tour, `neon.ts`, Functions, Auth, Object Storage, AI Gateway GA/get-started, model catalog) to guess APIs that still needed live probes.
3. **npm death spiral.** Repeated install attempts, verbose logs, `files-sdk` peer graph, package.json churn. You had to interrupt (“wtf is going on”).
4. **Error-driven Neon debugging, one 403 at a time.** Origin, then “not linked,” then Gateway-not-enabled — plus CLI help dumps and Console-oriented research for a flag that does not exist (`neon ai-gateway enable`).
5. **Process overhead.** Deploy/auth-domain commands blocked for approval; stale `next dev` PIDs; system notifications about aborted servers. Lots of status prose, little new code.
6. **Relatively cheap:** the actual app code (`functions/api.ts`, `lib/*`, pages) and the 8 unit tests.

If this session were replayed: **link an org that already has Gateway models enabled, generate cookie + invoke secrets first, bind Next to `localhost` or add `127.0.0.1` as a trusted domain immediately, skip `files-sdk`, skip the extra design gate.** That cuts most of the token burn.

## What we built (for context)

| Piece | Role |
|---|---|
| Next.js UI | Upload + log at `http://127.0.0.1:3000` |
| Postgres | `identifications` table |
| Managed Better Auth | Accounts (empty again after project move) |
| Bucket `birds` | Private photos via S3 |
| Function `api` | `/identify`, `/history`, `/health` |
| AI Gateway | `llama-4-maverick` after GPT was gated |

Current target: org `org-shy-forest-64288872`, project `holy-poetry-88306888`, branch `br-little-cloud-b5cc6h3k`.

## How you steered (this lens)

You were the product owner **and** the only person who could complete Neon’s human gates: OAuth, org choice, Console URL, live error strings, “turn Gateway on,” then **switch orgs and create a new project** when the first account couldn’t. You also killed waste (npm bloat, extra approval, “ask me about creds”) that the agent would have otherwise kept burning tokens on.

## Current status

- Local app and Function health: HTTP 200.
- Gateway works on the new org with `llama-4-maverick` (image probe succeeded).
- You created a new login on the new Auth database.
- **Not on the public web yet.** That is Vercel (or similar) + copying env vars + adding the HTTPS origin to Neon Auth trusted domains. That is another leave-the-session loop.

## Recommended next step

Upload a real bird photo against the new project and confirm it lands in `/log`. Then, if you want it on the internet, GitHub → Vercel env vars → `neon neon-auth domain add https://<your-host>`.
