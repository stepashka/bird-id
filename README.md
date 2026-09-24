# Fieldmark

Photograph a bird, identify the species, and keep a private field log.

This branch is a static React app designed for **GitHub Pages + Neon**:

```text
GitHub Pages ── Neon Auth JWT ──> Neon Function
                                    ├─ Postgres
                                    ├─ Object Storage
                                    └─ AI Gateway
```

The browser bundle contains only public Auth and Function URLs. Database,
Storage, and AI credentials remain inside Neon.

## Local development

```bash
npm install
cp .env.example .env.local
```

Set:

```dotenv
VITE_NEON_AUTH_URL=https://your-branch.neonauth.../neondb/auth
VITE_NEON_FUNCTION_API_URL=https://your-branch-api.compute...
NEON_AI_MODEL=gpt-5-4-mini
NEON_IMAGE_MODEL=gpt-5-mini
```

Trust the Vite origin in Neon Auth:

```bash
npx neon@latest neon-auth domain add http://127.0.0.1:5173 \
  --project-id holy-poetry-88306888 \
  --branch br-damp-morning-b5l3fkly
```

Then run:

```bash
npm run dev -- --host 127.0.0.1
```

## Neon backend

`neon.ts` declares Managed Auth, the private `birds` bucket, AI Gateway, and
the `api` Function. Link a supported-region project, then:

```bash
npx neon@latest deploy --env .env.local
```

The Function verifies browser JWTs against `NEON_AUTH_JWKS_URL` and derives
ownership from the JWT `sub`. It does not trust a browser-supplied user id.

### Fictional bird transformations

For an owned **Not a bird** result, the Function can edit the stored source
photo through Neon AI Gateway and save a linked, explicitly fictional bird.
Image generation uses the OpenAI Responses `image_generation` tool through
`neon.tools.imageGeneration()`; it is not a model returned by
`GET /v1/models` and does not use AI SDK `generateImage()`.

Cost controls:

- `NEON_IMAGE_MODEL` defaults to `gpt-5-mini`;
- three image-tool invocations per user per UTC day, including paid failures;
- one successful generated child per **Not a bird** source;
- generated JPEGs stay private under `generated/` in the existing `birds`
  bucket.

Operators can override the daily limit for a specific authenticated user
without an admin UI. Find the user id from a known recent identification,
then upsert a positive finite limit:

```sql
SELECT user_id, max(created_at) AS last_identification
FROM identifications
GROUP BY user_id
ORDER BY last_identification DESC;

INSERT INTO bird_generation_quota_overrides (user_id, daily_limit)
VALUES ('<user-id>', 100)
ON CONFLICT (user_id) DO UPDATE
SET daily_limit = EXCLUDED.daily_limit,
    updated_at = now();
```

Delete the row to restore the default limit of three:

```sql
DELETE FROM bird_generation_quota_overrides
WHERE user_id = '<user-id>';
```

## GitHub Pages

1. Push `main` to a GitHub repository.
2. In **Settings → Pages**, choose **GitHub Actions** as the source.
3. In **Settings → Secrets and variables → Actions → Variables**, create:
   - `VITE_NEON_AUTH_URL`
   - `VITE_NEON_FUNCTION_API_URL`
4. Push the branch or run the **Deploy Fieldmark to GitHub Pages** workflow.
5. Add the Pages origin to Neon Auth:

```bash
OWNER=$(git remote get-url origin | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#')
npx neon@latest neon-auth domain add "https://${OWNER}.github.io" \
  --project-id holy-poetry-88306888 \
  --branch br-damp-morning-b5l3fkly
```

GitHub project Pages uses `https://OWNER.github.io/REPOSITORY/`; Auth trusts
the origin (`https://OWNER.github.io`) while Vite handles the repository base
path.

## Verification

```bash
npm test
npm run lint
npm run build
```

`dist/` is the complete static site deployed by GitHub Actions.
