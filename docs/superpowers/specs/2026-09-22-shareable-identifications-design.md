# Shareable identifications design

## Goal

Let a signed-in user share one bird identification with anyone who has its
link. Sharing must not expose the owner's account or other identifications.

The shared URL will use the GitHub Pages-compatible form:

```text
https://stepashka.github.io/bird-id/?share=<random-token>
```

## User experience

Each identification card gets a **Share** button.

1. The owner presses **Share**.
2. The app creates a new public link for that identification.
3. The app opens the native device share sheet when available.
4. If the browser has no native share sheet, the app copies the link and
   confirms that it was copied.

The card also offers **Revoke shared links** after the first link is created.
Revocation disables every public link for that identification. The owner can
create a new link afterward.

A visitor opening a shared link sees only:

- the bird photo;
- common, scientific, and localized names;
- confidence, date, visible evidence, and alternatives;
- Wikipedia and Google Images links.

The page does not show the owner's identity, navigation to their log, or other
identifications. A missing, malformed, or revoked token shows a neutral
"This shared identification is unavailable" state.

## URL and routing

The Vite app reads the `share` query parameter before rendering the signed-in
application. If present, it renders a public shared-identification view and
does not wait for an Auth session.

A query parameter works on direct visits and refreshes because GitHub Pages
still serves the repository's root `index.html`. A path such as
`/bird-id/share/<token>` would require a custom 404 fallback.

GitHub Pages serves one static HTML document, so bird-specific Open Graph
titles and image previews are outside this change. The link opens the correct
identification, but messaging apps may show Fieldmark's generic site preview.

## Backend API

The Neon Function adds three routes:

- `POST /identifications/:id/shares` — authenticated; verifies ownership,
  creates a token, stores its hash, and returns `{ token }`.
- `DELETE /identifications/:id/shares` — authenticated; verifies ownership
  and revokes all links for that identification.
- `GET /shares/:token` — public; hashes the token, finds the identification,
  and returns the allowlisted public fields with a fresh signed photo URL.

Creating another link does not invalidate earlier links. Revocation removes
all links for the identification, which keeps the owner-facing control simple
and predictable.

The frontend gets the Pages origin and base path from `window.location`, so
the Function returns a token rather than assuming a deployment URL.

Authenticated identification and history responses add a `shared` boolean,
computed with an `EXISTS` lookup against the share table. This lets a reloaded
owner view show the revoke control without exposing any token.

## Data model

Add an `identification_shares` table:

```sql
CREATE TABLE IF NOT EXISTS identification_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identification_id uuid NOT NULL REFERENCES identifications(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identification_shares_identification_idx
  ON identification_shares (identification_id);
```

Tokens contain 32 random bytes encoded as base64url. The Function stores only
their SHA-256 hashes. A database reader therefore cannot use stored values as
public links.

No owner identifier is copied into the share table. Ownership checks join back
to `identifications.user_id`.

## Frontend boundaries

Authenticated share and revoke calls use the existing `birdApi`.
After either call, the card updates its local `shared` state.

A small public API client fetches `GET /shares/:token` without requesting an
Auth JWT. The response uses the existing `Sighting` shape, limited to public
fields.

The shared view reuses the identification presentation where practical, but
it has no private navigation. External links use `referrerPolicy="no-referrer"`
so the bearer token is not sent as a referrer.

## Security

- Sharing is opt-in; existing identifications stay private.
- Tokens have 256 bits of randomness and are compared by hash.
- The public endpoint returns one allowlisted record and no user data.
- Share creation and revocation require a valid JWT and record ownership.
- Invalid and revoked tokens return the same `404` response.
- The public endpoint issues a short-lived signed photo URL on each request.
- Responses must not log or echo the raw token outside the requested URL.

Rate limiting is not part of this change. Token entropy prevents practical
enumeration, and the endpoint performs one indexed lookup. We can add platform
rate limits later if abuse appears.

## Error handling

Share creation failures leave the identification private and show a concise
error on its card. Clipboard failure leaves the generated URL visible for
manual copying.

If native sharing is canceled, the app does not report an error. Revocation is
idempotent: revoking an identification with no active links succeeds.

## Testing and rollout

Automated tests cover:

- token generation and hashing;
- public response field allowlisting;
- ownership checks for create and revoke;
- invalid and revoked token behavior;
- query-string parsing;
- native-share and clipboard fallback behavior;
- shared-page rendering states.

Run unit tests, lint, and the production build before deploying. Deploy the
Function and frontend to the isolated Neon and Git branches first. Validate
create, open in a signed-out browser, share, and revoke. Production deployment
requires a separate confirmation after that validation.
