# Make it bird-like design

## Goal

When a signed-in owner gets a **Not a bird** identification, they can turn
that photo into a playful, photo-like bird and share the result. The
generated image and fictional names must never be mistaken for a real
species identification.

## User experience

Only the owner of a **Not a bird** result sees **Make it bird-like**.

1. Optional field: “Any special direction? (optional),” max 200 characters.
2. One click starts a default photo-edit transformation. The optional prompt
   is wrapped in fixed bird-edit instructions; it is never a free image
   prompt.
3. The UI shows “Growing feathers…” and ignores extra clicks until the
   request finishes.
4. On success, the generated result appears below the original and as a
   separate linked log entry.
5. Generated entries show **AI-generated fictional bird** prominently on
   owner views, shared pages, and social cards.
6. Generated entries use the existing **Share** / **Revoke** controls.

The original **Not a bird** identification stays in the log. Sharing the
generated result never exposes the original photo.

## Visual direction

Preserve the uploaded composition and subject. Add coherent bird traits
(beak, wings, plumage, talons) as a recognizable photo edit, not a
full redraw or illustration.

## Limits

- One successful generated child per original **Not a bird** identification.
  Failed generations do not consume that slot.
- Three image-tool invocations per signed-in user per UTC day. Requests
  rejected before the model (not eligible, already transformed, bad prompt
  shape) do not count. A 502 after the tool ran does count, so retries
  cannot burn unlimited credits.
- Prompt text is trimmed and capped at 200 characters. It is inserted as a
  delimited creative preference under fixed bird-edit instructions and cannot
  replace the fixed instructions. Do not pretend prompt-injection detection is
  reliable.

## Architecture

GitHub Pages stays a static SPA. The Neon Function owns generation, naming,
storage, quota, and sharing.

Neon AI Gateway has no `generateImage()` endpoint. Image edits go through
the OpenAI Responses `image_generation` tool on an enabled GPT model via
`neon.tools.imageGeneration()`. The original private photo is passed as
image content on the same request (JPEG output). Do not send
`inputFidelity`: Neon currently routes the tool to `gpt-image-2`, which
rejects that parameter.
Use streaming (`streamText`) so large image bytes do not hit the gateway’s
non-streaming size cap.

Fictional names are a second, cheap structured call on the generated image
with the current identification model (`gpt-5-4-mini` unless env overrides).

## Data model

Add to `identifications`:

```sql
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS source_identification_id uuid
    REFERENCES identifications(id) ON DELETE CASCADE;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS identifications_one_generated_child_idx
  ON identifications (source_identification_id)
  WHERE is_generated AND source_identification_id IS NOT NULL;
```

Track every paid image-tool invocation:

```sql
CREATE TABLE IF NOT EXISTS bird_generation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  source_identification_id uuid NOT NULL
    REFERENCES identifications(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('started', 'failed', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bird_generation_attempts_user_created_idx
  ON bird_generation_attempts (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bird_generation_one_active_attempt_idx
  ON bird_generation_attempts (source_identification_id)
  WHERE status = 'started';
```

Before calling the image tool, use a database transaction and a user-scoped
advisory lock to count today's attempts and insert a `started` row atomically.
Treat `started` attempts older than 15 minutes as failed before checking for
an active attempt. Update the row to `failed` or `succeeded` when the call
finishes. This prevents concurrent clicks from launching duplicate paid edits
and makes failed paid calls count toward the daily quota.

Generated photos use a `generated/` prefix in the existing private `birds`
bucket. Do not add a new bucket.

## Backend API

`POST /identifications/:id/make-bird` — JWT required.

- Verify ownership.
- Source must be **Not a bird** (`common_name` / `scientific_name` match
  the existing non-bird rules).
- Source must not already have a generated child.
- Caller must be under the daily quota.
- Body: optional `{ "prompt": string }`.

On success, insert a linked identification and return the normal `Sighting`
shape plus:

- `isGenerated: true`
- `sourceIdentificationId`

History and identify responses include those fields when present.

Sharing reuses `POST/DELETE /identifications/:id/shares` and
`GET /shares/:token`. Public payloads for generated identifications include
the fictional names, generated photo URL, and `isGenerated: true`. They
must not include the source photo URL.

Social preview generation on publish uses the generated image and names and
must include the fictional-bird label in the card text.

## Error handling

| Case | Behavior |
|---|---|
| Not owner / missing id | 404, generic unavailable |
| Source is a bird | 400, not eligible |
| Child already exists | 409, already transformed |
| Daily quota used | 429, try tomorrow |
| Image tool timeout, empty bytes, moderation | 502, “Couldn’t grow feathers this time. Try again.” No row. |
| Naming fails after a good image | Insert anyway with `Mystery Bird` / `Aves imaginaria` |

## Cost and runtime

Neon passes through provider image-tool pricing onto prepaid credits.
Functions may run up to 15 minutes; generation is synchronous in the
request. Prefer medium quality and JPEG compression so responses stay
within gateway size limits.

Document in the session summary that `/v1/models` listing no image model
does **not** mean image generation is unavailable.

## Testing

- Unit: eligibility, quota, prompt sanitizing, fictional labeling, public
  share payload never includes the source photo.
- Route: owner vs non-owner, already-generated, quota, success insert,
  failed generation creates no row.
- Mock the image tool and naming model. No live Neon calls in unit tests.
- Manual on Neon `dev`: non-bird photo, optional prompt, log entry, share,
  social preview, revoke.

## Out of scope

- Regenerating after a successful child exists.
- Free-form unrestricted image generation.
- Backfilling names or images onto historical identifications.
- A separate creations table or bucket.
