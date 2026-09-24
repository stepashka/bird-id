import {
  GENERATION_DAILY_LIMIT,
  isNotBirdIdentification,
} from "./bird-generation";

export type Reservation =
  | {
      kind: "ready";
      attemptId: string;
      objectKey: string;
      contentType: string;
    }
  | { kind: "not_found" }
  | { kind: "not_eligible" }
  | { kind: "already_generated" }
  | { kind: "in_progress" }
  | { kind: "quota" };

export type GenerationAttemptClient = {
  query<Row = unknown>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount?: number | null }>;
  release(): void;
};

export type GenerationAttemptPool = {
  connect(): Promise<GenerationAttemptClient>;
};

export async function reserveGenerationAttempt(
  pool: GenerationAttemptPool,
  input: {
    userId: string;
    sourceIdentificationId: string;
  },
): Promise<Reservation> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`bird-generation:${input.userId}`],
    );
    await client.query(
      `UPDATE bird_generation_attempts
       SET status = 'failed'
       WHERE source_identification_id = $1
         AND status = 'started'
         AND created_at < now() - interval '15 minutes'`,
      [input.sourceIdentificationId],
    );

    const { rows } = await client.query<{
      object_key: string;
      content_type: string;
      common_name: string;
      scientific_name: string;
      is_generated: boolean;
      has_generated_child: boolean;
      has_active_attempt: boolean;
    }>(
      `SELECT source.object_key,
              source.content_type,
              source.common_name,
              source.scientific_name,
              source.is_generated,
              EXISTS (
                SELECT 1
                FROM identifications child
                WHERE child.source_identification_id = source.id
                  AND child.is_generated
              ) AS has_generated_child,
              EXISTS (
                SELECT 1
                FROM bird_generation_attempts attempt
                WHERE attempt.source_identification_id = source.id
                  AND attempt.status = 'started'
              ) AS has_active_attempt
       FROM identifications source
       WHERE source.id = $1 AND source.user_id = $2`,
      [input.sourceIdentificationId, input.userId],
    );
    const source = rows[0];
    let reservation: Reservation;

    if (!source) {
      reservation = { kind: "not_found" };
    } else if (
      source.is_generated ||
      !isNotBirdIdentification(source.common_name, source.scientific_name)
    ) {
      reservation = { kind: "not_eligible" };
    } else if (source.has_generated_child) {
      reservation = { kind: "already_generated" };
    } else if (source.has_active_attempt) {
      reservation = { kind: "in_progress" };
    } else {
      const quota = await client.query<{ attempts: number }>(
        `SELECT count(*)::int AS attempts
         FROM bird_generation_attempts
         WHERE user_id = $1
           AND created_at >=
             date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
        [input.userId],
      );
      if ((quota.rows[0]?.attempts ?? 0) >= GENERATION_DAILY_LIMIT) {
        reservation = { kind: "quota" };
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO bird_generation_attempts
             (user_id, source_identification_id, status)
           VALUES ($1, $2, 'started')
           RETURNING id`,
          [input.userId, input.sourceIdentificationId],
        );
        reservation = {
          kind: "ready",
          attemptId: inserted.rows[0]!.id,
          objectKey: source.object_key,
          contentType: source.content_type,
        };
      }
    }

    await client.query("COMMIT");
    return reservation;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
