import { neon } from "@neon/ai-sdk-provider";
import { attachDatabasePool } from "@neon/functions";
import { generateObject, generateText } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Pool } from "pg";
import { z } from "zod";
import { AuthError, resolveUserId } from "../lib/auth";
import {
  IDENTIFY_SYSTEM_PROMPT,
  parseIdentification,
  parseIdentificationJson,
} from "../lib/identification";
import { objectKeyForUser, validateImageUpload } from "../lib/image";
import { signedPhotoUrl, uploadPhoto } from "../lib/storage";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS identifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  common_name text NOT NULL,
  scientific_name text NOT NULL,
  confidence real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identifications_user_created_idx
  ON identifications (user_id, created_at DESC);
`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

const birdSchema = z.object({
  commonName: z.string(),
  scientificName: z.string(),
  confidence: z.number(),
});

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).then(() => undefined);
  }
  return schemaReady;
}

async function userIdFromRequest(c: { req: { header: (name: string) => string | undefined } }) {
  return resolveUserId({
    authorization: c.req.header("authorization"),
    jwksUrl: process.env.NEON_AUTH_JWKS_URL,
  });
}

async function identifyBird(bytes: Uint8Array, contentType: string) {
  const modelId = process.env.NEON_AI_MODEL || "gpt-5-mini";
  const model = neon(modelId);
  const image = Buffer.from(bytes);

  try {
    const result = await generateObject({
      model,
      schema: birdSchema,
      system: IDENTIFY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image, mediaType: contentType },
            { type: "text", text: "Identify the bird in this photo." },
          ],
        },
      ],
    });
    return parseIdentification(result.object);
  } catch {
    const result = await generateText({
      model,
      system: IDENTIFY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image, mediaType: contentType },
            {
              type: "text",
              text: "Identify the bird in this photo. Return JSON only.",
            },
          ],
        },
      ],
    });
    return parseIdentificationJson(result.text);
  }
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.post("/identify", async (c) => {
  try {
    await ensureSchema();
    const userId = await userIdFromRequest(c);
    const form = await c.req.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return c.json({ error: "Choose a photo of the bird." }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const invalid = validateImageUpload({ bytes, contentType });
    if (invalid) {
      return c.json({ error: invalid.message }, 400);
    }

    const identification = await identifyBird(bytes, contentType);
    const objectKey = objectKeyForUser(userId, contentType);
    await uploadPhoto(objectKey, Buffer.from(bytes), contentType);

    const inserted = await pool.query<{
      id: string;
      created_at: Date;
    }>(
      `insert into identifications
        (user_id, object_key, content_type, common_name, scientific_name, confidence)
       values ($1, $2, $3, $4, $5, $6)
       returning id, created_at`,
      [
        userId,
        objectKey,
        contentType,
        identification.commonName,
        identification.scientificName,
        identification.confidence,
      ],
    );

    const photoUrl = await signedPhotoUrl(objectKey);
    const row = inserted.rows[0];
    return c.json({
      id: row.id,
      createdAt: row.created_at,
      photoUrl,
      ...identification,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Identification failed.";
    return c.json({ error: message }, 500);
  }
});

app.get("/history", async (c) => {
  try {
    await ensureSchema();
    const userId = await userIdFromRequest(c);
    const { rows } = await pool.query<{
      id: string;
      object_key: string;
      common_name: string;
      scientific_name: string;
      confidence: number;
      created_at: Date;
    }>(
      `select id, object_key, common_name, scientific_name, confidence, created_at
       from identifications
       where user_id = $1
       order by created_at desc
       limit 50`,
      [userId],
    );

    const items = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        confidence: row.confidence,
        createdAt: row.created_at,
        photoUrl: await signedPhotoUrl(row.object_key),
      })),
    );

    return c.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Could not load history.";
    return c.json({ error: message }, 500);
  }
});

export default app;
