import { Hono } from "hono";
import { AuthError } from "../lib/auth";
import type { GeneratedBird } from "../lib/bird-generation-ai";
import {
  GenerationInputError,
  normalizeGenerationPrompt,
} from "../lib/bird-generation";

export class GeneratedAlreadyExistsError extends Error {
  constructor() {
    super("A fictional bird already exists for this identification.");
    this.name = "GeneratedAlreadyExistsError";
  }
}

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

export type GeneratedSighting = {
  id: string;
  commonName: string;
  scientificName: string;
  confidence: number;
  createdAt: string;
  photoUrl: string;
  names: Record<string, string>;
  alternatives: string[];
  evidence: string[];
  shared: boolean;
  isGenerated: true;
  sourceIdentificationId: string;
  hasGeneratedChild: false;
};

export type BirdGenerationRouteDependencies = {
  resolveUserId(authorization: string | undefined): Promise<string>;
  reserveAttempt(input: {
    userId: string;
    sourceIdentificationId: string;
  }): Promise<Reservation>;
  readPhoto(objectKey: string): Promise<Uint8Array>;
  generateBird(input: {
    source: Uint8Array;
    contentType: string;
    preference?: string;
  }): Promise<GeneratedBird>;
  persistGenerated(input: {
    attemptId: string;
    userId: string;
    sourceIdentificationId: string;
    generated: GeneratedBird;
  }): Promise<GeneratedSighting>;
  failAttempt(attemptId: string): Promise<void>;
};

const RESERVATION_ERRORS = {
  not_found: {
    status: 404,
    error: "Identification not found.",
  },
  not_eligible: {
    status: 400,
    error: "Only a Not a bird result can grow feathers.",
  },
  already_generated: {
    status: 409,
    error: "This photo already has a fictional bird.",
  },
  in_progress: {
    status: 409,
    error: "This photo is already growing feathers.",
  },
  quota: {
    status: 429,
    error: "You’ve used today’s transformation allowance. Try again tomorrow.",
  },
} as const;

export function createBirdGenerationRoutes(
  deps: BirdGenerationRouteDependencies,
) {
  const app = new Hono();

  app.post("/identifications/:id/make-bird", async (c) => {
    try {
      const userId = await deps.resolveUserId(c.req.header("Authorization"));
      const body = await c.req.json().catch(() => ({}));
      const preference = normalizeGenerationPrompt(
        body && typeof body === "object" && "prompt" in body
          ? body.prompt
          : undefined,
      );
      const sourceIdentificationId = c.req.param("id");
      const reservation = await deps.reserveAttempt({
        userId,
        sourceIdentificationId,
      });

      if (reservation.kind !== "ready") {
        const response = RESERVATION_ERRORS[reservation.kind];
        return c.json({ error: response.error }, response.status);
      }

      try {
        const source = await deps.readPhoto(reservation.objectKey);
        const generated = await deps.generateBird({
          source,
          contentType: reservation.contentType,
          preference,
        });
        const saved = await deps.persistGenerated({
          attemptId: reservation.attemptId,
          userId,
          sourceIdentificationId,
          generated,
        });
        return c.json(saved, 201);
      } catch (error) {
        await deps.failAttempt(reservation.attemptId).catch(() => undefined);
        if (error instanceof GeneratedAlreadyExistsError) {
          return c.json(
            { error: RESERVATION_ERRORS.already_generated.error },
            RESERVATION_ERRORS.already_generated.status,
          );
        }
        return c.json(
          { error: "Couldn’t grow feathers this time. Try again." },
          502,
        );
      }
    } catch (error) {
      if (error instanceof AuthError) {
        return c.json({ error: error.message }, error.status);
      }
      if (error instanceof GenerationInputError) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: "Could not start the transformation." }, 500);
    }
  });

  return app;
}
