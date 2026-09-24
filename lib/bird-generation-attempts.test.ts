import { describe, expect, it } from "vitest";
import {
  reserveGenerationAttempt,
  type GenerationAttemptClient,
  type GenerationAttemptPool,
} from "./bird-generation-attempts";

type SourceRow = {
  object_key: string;
  content_type: string;
  common_name: string;
  scientific_name: string;
  is_generated: boolean;
  has_generated_child: boolean;
  has_active_attempt: boolean;
};

function fakePool(input: {
  source?: SourceRow;
  attempts?: number;
  dailyLimit?: number;
}) {
  const statements: string[] = [];
  const client: GenerationAttemptClient = {
    async query<Row>(sql: string) {
      statements.push(sql.replace(/\s+/g, " ").trim());
      if (sql.includes("FROM identifications source")) {
        return { rows: input.source ? [input.source as Row] : [] };
      }
      if (sql.includes("count(*)::int AS attempts")) {
        return { rows: [{ attempts: input.attempts ?? 0 } as Row] };
      }
      if (sql.includes("FROM bird_generation_quota_overrides")) {
        return {
          rows:
            input.dailyLimit === undefined
              ? []
              : [{ daily_limit: input.dailyLimit } as Row],
        };
      }
      if (sql.includes("INSERT INTO bird_generation_attempts")) {
        return { rows: [{ id: "attempt-1" } as Row] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool: GenerationAttemptPool = {
    async connect() {
      return client;
    },
  };
  return { pool, statements };
}

const eligibleSource: SourceRow = {
  object_key: "user/source.jpg",
  content_type: "image/jpeg",
  common_name: "Not a bird",
  scientific_name: "n/a",
  is_generated: false,
  has_generated_child: false,
  has_active_attempt: false,
};

describe("reserveGenerationAttempt", () => {
  it("takes a user lock and expires stale work before inspecting the source", async () => {
    const { pool, statements } = fakePool({ source: eligibleSource });

    await expect(
      reserveGenerationAttempt(pool, {
        userId: "user-1",
        sourceIdentificationId: "source-1",
      }),
    ).resolves.toMatchObject({ kind: "ready", attemptId: "attempt-1" });

    expect(statements.findIndex((sql) => sql.includes("pg_advisory_xact_lock")))
      .toBeLessThan(
        statements.findIndex((sql) =>
          sql.includes("UPDATE bird_generation_attempts"),
        ),
      );
    expect(
      statements.findIndex((sql) =>
        sql.includes("UPDATE bird_generation_attempts"),
      ),
    ).toBeLessThan(
      statements.findIndex((sql) =>
        sql.includes("FROM identifications source"),
      ),
    );
    expect(statements).toContain("COMMIT");
  });

  it("does not insert a second paid attempt while one is active", async () => {
    const { pool, statements } = fakePool({
      source: { ...eligibleSource, has_active_attempt: true },
    });

    await expect(
      reserveGenerationAttempt(pool, {
        userId: "user-1",
        sourceIdentificationId: "source-1",
      }),
    ).resolves.toEqual({ kind: "in_progress" });
    expect(
      statements.some((sql) => sql.includes("INSERT INTO bird_generation_attempts")),
    ).toBe(false);
  });

  it("rejects the fourth paid invocation in a UTC day", async () => {
    const { pool, statements } = fakePool({
      source: eligibleSource,
      attempts: 3,
    });

    await expect(
      reserveGenerationAttempt(pool, {
        userId: "user-1",
        sourceIdentificationId: "source-1",
      }),
    ).resolves.toEqual({ kind: "quota" });
    expect(
      statements.some((sql) => sql.includes("INSERT INTO bird_generation_attempts")),
    ).toBe(false);
    expect(
      statements.some(
        (sql) =>
          sql.includes("date_trunc('day'") &&
          sql.includes("AT TIME ZONE 'UTC'"),
      ),
    ).toBe(true);
  });

  it("allows attempts up to a user's raised daily limit", async () => {
    const { pool } = fakePool({
      source: eligibleSource,
      attempts: 3,
      dailyLimit: 10,
    });

    await expect(
      reserveGenerationAttempt(pool, {
        userId: "user-1",
        sourceIdentificationId: "source-1",
      }),
    ).resolves.toMatchObject({ kind: "ready", attemptId: "attempt-1" });
  });

  it("blocks attempts at a user's lowered daily limit", async () => {
    const { pool, statements } = fakePool({
      source: eligibleSource,
      attempts: 2,
      dailyLimit: 2,
    });

    await expect(
      reserveGenerationAttempt(pool, {
        userId: "user-1",
        sourceIdentificationId: "source-1",
      }),
    ).resolves.toEqual({ kind: "quota" });
    expect(
      statements.some((sql) =>
        sql.includes("INSERT INTO bird_generation_attempts"),
      ),
    ).toBe(false);
  });
});
