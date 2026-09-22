# Fieldmark

Photograph a bird. The service names the species and stores the identification on your account.

## Stack

- Next.js UI (Vercel / `npm run dev`)
- Neon backend from `neon.ts`: Postgres, Managed Better Auth, Object Storage, Functions, AI Gateway

## Run it

1. Install the Neon CLI and sign in:

```bash
npm i -g neon
neon login
```

2. Install app dependencies:

```bash
npm install
```

3. Link a project in a region that has Functions / Storage / AI Gateway (`aws-us-east-2` is a safe default):

```bash
neon link --project-name bird-id --region-id aws-us-east-2
```

4. Put a cookie secret and an invoke secret in `.env.local` (Neon will add the rest on deploy):

```bash
openssl rand -base64 32
```

```bash
NEON_AUTH_COOKIE_SECRET=
FUNCTION_INVOKE_SECRET=
NEON_AI_MODEL=gpt-5-mini
```

5. Deploy the backend and pull URLs/credentials:

```bash
export FUNCTION_INVOKE_SECRET="the same value as in .env.local"
neon deploy
```

Confirm `.env` / `.env.local` now includes `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_FUNCTION_API_BASE_URL`, AI Gateway, and AWS storage vars. Copy `FUNCTION_INVOKE_SECRET` into `.env.local` if deploy wrote a different env file.

6. Run the UI and (optionally) functions locally:

```bash
npm run neon:dev   # functions on localhost
npm run dev        # Next.js on localhost:3000
```

If `neon dev` prints a local function URL, set `NEON_FUNCTION_API_BASE_URL` to that URL while you iterate.

## Tests

```bash
npm test
```

These cover photo validation, model JSON parsing, and the Next.js → Function auth header contract. They do not call Neon.
