import { neon } from "@neon/ai-sdk-provider";
import { attachDatabasePool } from "@neon/functions";
import { generateObject, generateText } from "ai";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { AuthError, resolveUserId } from "../lib/auth";
import { generateBirdTransformation } from "../lib/bird-generation-ai";
import {
  reserveGenerationAttempt,
  type GenerationAttemptPool,
} from "../lib/bird-generation-attempts";
import { persistGeneratedAsset } from "../lib/bird-generation-persistence";
import { lookupLocalizedNames } from "../lib/bird-names";
import { feedbackScreenshotKey, persistFeedback } from "../lib/feedback";
import {
  IDENTIFY_SYSTEM_PROMPT,
  parseIdentification,
  parseIdentificationJson,
} from "../lib/identification";
import {
  generatedObjectKeyForUser,
  objectKeyForUser,
  validateImageUpload,
} from "../lib/image";
import {
  publishShare,
  revokePublishedShares,
} from "../lib/share-publishing";
import type { SharedIdentificationRow } from "../lib/sharing";
import { renderSocialPreview } from "../lib/social-preview";
import {
  deleteSocialPreview,
  deletePhoto,
  deleteFeedbackScreenshot,
  readPhoto,
  readSocialPreview,
  signedPhotoUrl,
  uploadFeedbackScreenshot,
  uploadPhoto,
  uploadSocialPreview,
} from "../lib/storage";
import {
  createBirdGenerationRoutes,
  GeneratedAlreadyExistsError,
  type GeneratedSighting,
} from "./bird-generation-routes";
import { createFeedbackRoutes } from "./feedback-routes";
import { createShareRoutes } from "./share-routes";

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
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS common_names jsonb;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS alternatives jsonb;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS evidence jsonb;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS source_identification_id uuid
    REFERENCES identifications(id) ON DELETE CASCADE;
ALTER TABLE identifications
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS identifications_one_generated_child_idx
  ON identifications (source_identification_id)
  WHERE is_generated AND source_identification_id IS NOT NULL;
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
CREATE TABLE IF NOT EXISTS identification_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identification_id uuid NOT NULL REFERENCES identifications(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  preview_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE identification_shares
  ADD COLUMN IF NOT EXISTS preview_key text;
CREATE INDEX IF NOT EXISTS identification_shares_identification_idx
  ON identification_shares (identification_id);
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  message text NOT NULL,
  screenshot_key text,
  screenshot_content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_user_created_idx
  ON feedback (user_id, created_at DESC);
`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

const birdSchema = z.object({
  commonName: z.string(),
  scientificName: z.string(),
  confidence: z.number(),
  alternatives: z.array(z.string()).max(3).optional(),
  evidence: z.array(z.string()).max(3).optional(),
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

type GeneratedBirdPersistenceInput = {
  attemptId: string;
  userId: string;
  sourceIdentificationId: string;
  generated: Awaited<ReturnType<typeof generateBirdTransformation>>;
};

async function persistGeneratedBird(
  input: GeneratedBirdPersistenceInput,
): Promise<GeneratedSighting> {
  const persisted = await persistGeneratedAsset<
    GeneratedBirdPersistenceInput,
    { id: string; created_at: Date }
  >({
    createObjectKey: ({ userId }) => generatedObjectKeyForUser(userId),
    uploadObject: (objectKey, bytes, contentType) =>
      uploadPhoto(objectKey, Buffer.from(bytes), contentType),
    commitRecord: async (objectKey, currentInput) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query<{
          id: string;
          created_at: Date;
        }>(
          `INSERT INTO identifications
             (user_id, object_key, content_type, common_name, scientific_name,
              confidence, common_names, alternatives, evidence,
              source_identification_id, is_generated)
           VALUES ($1, $2, $3, $4, $5, 1, '{}'::jsonb, '[]'::jsonb, $6::jsonb,
                   $7, true)
           RETURNING id, created_at`,
          [
            currentInput.userId,
            objectKey,
            currentInput.generated.contentType,
            currentInput.generated.commonName,
            currentInput.generated.scientificName,
            JSON.stringify(["AI-generated fictional bird"]),
            currentInput.sourceIdentificationId,
          ],
        );
        const completed = await client.query(
          `UPDATE bird_generation_attempts
           SET status = 'succeeded'
           WHERE id = $1
             AND user_id = $2
             AND source_identification_id = $3
             AND status = 'started'`,
          [
            currentInput.attemptId,
            currentInput.userId,
            currentInput.sourceIdentificationId,
          ],
        );
        if ((completed.rowCount ?? 0) !== 1) {
          throw new Error("Generation attempt is no longer active.");
        }
        await client.query("COMMIT");
        return inserted.rows[0]!;
      } catch (error) {
        await rollback(client);
        if (isGeneratedChildConflict(error)) {
          throw new GeneratedAlreadyExistsError();
        }
        throw error;
      } finally {
        client.release();
      }
    },
    signObject: signedPhotoUrl,
    deleteObject: deletePhoto,
  })(input);

  return {
    id: persisted.record.id,
    commonName: input.generated.commonName,
    scientificName: input.generated.scientificName,
    confidence: 1,
    createdAt: persisted.record.created_at.toISOString(),
    photoUrl: persisted.photoUrl,
    names: {},
    alternatives: [],
    evidence: ["AI-generated fictional bird"],
    shared: false,
    isGenerated: true,
    sourceIdentificationId: input.sourceIdentificationId,
    hasGeneratedChild: false,
  };
}

async function rollback(client: PoolClient) {
  await client.query("ROLLBACK").catch(() => undefined);
}

function isGeneratedChildConflict(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "identifications_one_generated_child_idx"
  );
}

async function identifyBird(bytes: Uint8Array, contentType: string) {
  const modelId = process.env.NEON_AI_MODEL || "gpt-5-4-mini";
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
            {
              type: "text",
              text: "Identify the bird from visible field marks. Return the requested JSON only.",
            },
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
              text: "Identify the bird from visible field marks. Return JSON only.",
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
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route(
  "/",
  createFeedbackRoutes({
    resolveUserId: async (authorization) => {
      try {
        return await resolveUserId({
          authorization,
          jwksUrl: process.env.NEON_AUTH_JWKS_URL,
        });
      } catch (error) {
        if (error instanceof AuthError) {
          throw new AuthError("Sign in to send feedback.");
        }
        throw error;
      }
    },
    saveFeedback: async ({ userId, message, screenshot }) => {
      await ensureSchema();
      return persistFeedback(
        {
          insertFeedback: async ({ userId, message }) => {
            const { rows } = await pool.query<{
              id: string;
              created_at: Date;
            }>(
              `INSERT INTO feedback (user_id, message)
               VALUES ($1, $2)
               RETURNING id, created_at`,
              [userId, message],
            );
            return { id: rows[0].id, createdAt: rows[0].created_at };
          },
          uploadScreenshot: async (key, bytes, contentType) =>
            uploadFeedbackScreenshot(key, Buffer.from(bytes), contentType),
          attachScreenshot: async ({ feedbackId, key, contentType }) => {
            await pool.query(
              `UPDATE feedback
               SET screenshot_key = $2, screenshot_content_type = $3
               WHERE id = $1`,
              [feedbackId, key, contentType],
            );
          },
          deleteFeedback: async (feedbackId) => {
            await pool.query(`DELETE FROM feedback WHERE id = $1`, [
              feedbackId,
            ]);
          },
          deleteScreenshot: deleteFeedbackScreenshot,
          screenshotKey: feedbackScreenshotKey,
        },
        { userId, message, screenshot },
      );
    },
  }),
);

app.route(
  "/",
  createBirdGenerationRoutes({
    resolveUserId: async (authorization) => {
      try {
        return await resolveUserId({
          authorization,
          jwksUrl: process.env.NEON_AUTH_JWKS_URL,
        });
      } catch (error) {
        if (error instanceof AuthError) {
          throw new AuthError("Sign in to transform this photo.");
        }
        throw error;
      }
    },
    reserveAttempt: async (input) => {
      await ensureSchema();
      return reserveGenerationAttempt(
        pool as unknown as GenerationAttemptPool,
        input,
      );
    },
    readPhoto,
    generateBird: generateBirdTransformation,
    persistGenerated: persistGeneratedBird,
    failAttempt: async (attemptId) => {
      await pool.query(
        `UPDATE bird_generation_attempts
         SET status = 'failed'
         WHERE id = $1 AND status = 'started'`,
        [attemptId],
      );
    },
  }),
);

app.route(
  "/",
  createShareRoutes({
    resolveUserId: async (authorization) =>
      resolveUserId({
        authorization,
        jwksUrl: process.env.NEON_AUTH_JWKS_URL,
      }),
    createShare: async (input) => {
      await ensureSchema();
      return publishShare(
        {
          findOwnedIdentification: async ({
            identificationId,
            userId,
          }) => {
            const { rows } = await pool.query<{
              id: string;
              object_key: string;
              existing_preview_key: string | null;
            }>(
              `SELECT identification.id,
                      identification.object_key,
                      (
                        SELECT share.preview_key
                        FROM identification_shares share
                        WHERE share.identification_id = identification.id
                          AND share.preview_key IS NOT NULL
                        LIMIT 1
                      ) AS existing_preview_key
               FROM identifications identification
               WHERE identification.id = $1 AND identification.user_id = $2`,
              [identificationId, userId],
            );
            const row = rows[0];
            return row
              ? {
                  id: row.id,
                  objectKey: row.object_key,
                  existingPreviewKey: row.existing_preview_key,
                }
              : null;
          },
          loadOriginalPhoto: readPhoto,
          renderPreview: renderSocialPreview,
          uploadPreview: uploadSocialPreview,
          insertShare: async ({
            identificationId,
            userId,
            tokenHash,
            previewKey,
          }) => {
            const inserted = await pool.query(
              `INSERT INTO identification_shares
                 (identification_id, token_hash, preview_key)
               SELECT id, $3, $4
               FROM identifications
               WHERE id = $1 AND user_id = $2
               RETURNING id`,
              [identificationId, userId, tokenHash, previewKey],
            );
            return (inserted.rowCount ?? 0) > 0;
          },
          deletePreview: deleteSocialPreview,
        },
        input,
      );
    },
    revokeShares: async (input) => {
      await ensureSchema();
      return revokePublishedShares(
        {
          deletePreview: deleteSocialPreview,
          removeShares: async ({ identificationId, userId }) => {
            const owned = await pool.query(
              `SELECT id
               FROM identifications
               WHERE id = $1 AND user_id = $2`,
              [identificationId, userId],
            );
            if ((owned.rowCount ?? 0) === 0) return null;

            const { rows } = await pool.query<{ preview_key: string | null }>(
              `DELETE FROM identification_shares
               WHERE identification_id = $1
               RETURNING preview_key`,
              [identificationId],
            );
            return rows.flatMap((row) =>
              row.preview_key ? [row.preview_key] : [],
            );
          },
        },
        input,
      );
    },
    findShared: async (tokenHash) => {
      await ensureSchema();
      const { rows } = await pool.query<SharedIdentificationRow>(
        `SELECT identifications.id,
                identifications.user_id,
                identifications.object_key,
                identifications.common_name,
                identifications.scientific_name,
                identifications.confidence,
                identifications.created_at,
                identifications.common_names,
                identifications.alternatives,
                identifications.evidence,
                identifications.is_generated,
                identification_shares.preview_key
         FROM identification_shares
         JOIN identifications
           ON identifications.id = identification_shares.identification_id
         WHERE identification_shares.token_hash = $1`,
        [tokenHash],
      );
      return rows[0] ?? null;
    },
    signedPhotoUrl,
    publicAppUrl: process.env.SHARE_APP_URL ?? "https://bird-id.app/",
    publicShareUrl: process.env.SHARE_PUBLIC_URL ?? "https://share.bird-id.app/",
    getPreviewPhoto: readSocialPreview,
  }),
);

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
    const names = await lookupLocalizedNames(
      identification.commonName,
      identification.scientificName,
    ).catch(() => ({}));
    const objectKey = objectKeyForUser(userId, contentType);
    await uploadPhoto(objectKey, Buffer.from(bytes), contentType);

    const inserted = await pool.query<{
      id: string;
      created_at: Date;
    }>(
      `insert into identifications
        (user_id, object_key, content_type, common_name, scientific_name, confidence, common_names, alternatives, evidence)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, created_at`,
      [
        userId,
        objectKey,
        contentType,
        identification.commonName,
        identification.scientificName,
        identification.confidence,
        JSON.stringify(names),
        JSON.stringify(identification.alternatives ?? []),
        JSON.stringify(identification.evidence ?? []),
      ],
    );

    const photoUrl = await signedPhotoUrl(objectKey);
    const row = inserted.rows[0];
    return c.json({
      id: row.id,
      createdAt: row.created_at,
      photoUrl,
      names,
      shared: false,
      isGenerated: false,
      sourceIdentificationId: null,
      hasGeneratedChild: false,
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
      common_names: unknown;
      alternatives: string[] | null;
      evidence: string[] | null;
      shared: boolean;
      is_generated: boolean;
      source_identification_id: string | null;
      has_generated_child: boolean;
    }>(
      `select id, object_key, common_name, scientific_name, confidence, created_at, common_names,
              alternatives, evidence, is_generated, source_identification_id,
              EXISTS (
                SELECT 1 FROM identification_shares shares
                WHERE shares.identification_id = identifications.id
              ) AS shared,
              EXISTS (
                SELECT 1 FROM identifications child
                WHERE child.source_identification_id = identifications.id
                  AND child.is_generated
              ) AS has_generated_child
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
        names: row.common_names ?? {},
        alternatives: row.alternatives ?? [],
        evidence: row.evidence ?? [],
        shared: row.shared,
        isGenerated: row.is_generated,
        sourceIdentificationId: row.source_identification_id,
        hasGeneratedChild: row.has_generated_child,
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
