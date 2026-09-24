import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../lib/auth";
import {
  createBirdGenerationRoutes,
  GeneratedAlreadyExistsError,
  type BirdGenerationRouteDependencies,
  type GeneratedSighting,
  type Reservation,
} from "./bird-generation-routes";

const generated = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  contentType: "image/jpeg" as const,
  commonName: "Velvet Teapot Finch",
  scientificName: "Theiera velutina",
};

const sighting: GeneratedSighting = {
  id: "generated-1",
  commonName: generated.commonName,
  scientificName: generated.scientificName,
  confidence: 1,
  createdAt: "2026-09-24T12:00:00.000Z",
  photoUrl: "https://signed.example/generated",
  names: {},
  alternatives: [],
  evidence: ["AI-generated fictional bird"],
  shared: false,
  isGenerated: true,
  sourceIdentificationId: "source-1",
  hasGeneratedChild: false,
};

function dependencies(
  overrides: Partial<BirdGenerationRouteDependencies> = {},
): BirdGenerationRouteDependencies {
  return {
    resolveUserId: async () => "user-1",
    reserveAttempt: async () => ({
      kind: "ready",
      attemptId: "attempt-1",
      objectKey: "user-1/source.jpg",
      contentType: "image/jpeg",
    }),
    readPhoto: async () => new Uint8Array([1, 2, 3]),
    generateBird: async () => generated,
    persistGenerated: async () => sighting,
    failAttempt: async () => undefined,
    ...overrides,
  };
}

function postBody(prompt?: unknown) {
  return {
    method: "POST",
    headers: {
      Authorization: "Bearer user-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prompt === undefined ? {} : { prompt }),
  };
}

describe("bird generation routes", () => {
  it("requires authentication", async () => {
    const app = createBirdGenerationRoutes(
      dependencies({
        resolveUserId: async () => {
          throw new AuthError("Sign in to transform this photo.");
        },
      }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody(),
    );

    expect(response.status).toBe(401);
  });

  it.each<[Reservation["kind"], number]>([
    ["not_found", 404],
    ["not_eligible", 400],
    ["already_generated", 409],
    ["in_progress", 409],
    ["quota", 429],
  ])("maps %s reservations to HTTP %i", async (kind, status) => {
    const generateBird = vi.fn();
    const app = createBirdGenerationRoutes(
      dependencies({
        reserveAttempt: async () => ({ kind } as Reservation),
        generateBird,
      }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody(),
    );

    expect(response.status).toBe(status);
    expect(generateBird).not.toHaveBeenCalled();
  });

  it("describes quota exhaustion without hard-coding the default limit", async () => {
    const app = createBirdGenerationRoutes(
      dependencies({
        reserveAttempt: async () => ({ kind: "quota" }),
      }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody(),
    );

    await expect(response.json()).resolves.toEqual({
      error: "You’ve used today’s transformation allowance. Try again tomorrow.",
    });
  });

  it("rejects a non-string prompt before reserving an attempt", async () => {
    const reserveAttempt = vi.fn();
    const app = createBirdGenerationRoutes(dependencies({ reserveAttempt }));

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody({ direction: "wings" }),
    );

    expect(response.status).toBe(400);
    expect(reserveAttempt).not.toHaveBeenCalled();
  });

  it("rejects a prompt over 200 characters before reserving", async () => {
    const reserveAttempt = vi.fn();
    const app = createBirdGenerationRoutes(dependencies({ reserveAttempt }));

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody("x".repeat(201)),
    );

    expect(response.status).toBe(400);
    expect(reserveAttempt).not.toHaveBeenCalled();
  });

  it("persists and returns a generated sighting", async () => {
    const persistGenerated = vi.fn(async () => sighting);
    const app = createBirdGenerationRoutes(
      dependencies({ persistGenerated }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody("blue tail"),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: "generated-1",
      isGenerated: true,
      sourceIdentificationId: "source-1",
    });
    expect(persistGenerated).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      userId: "user-1",
      sourceIdentificationId: "source-1",
      generated,
    });
  });

  it("marks the paid attempt failed when generation throws", async () => {
    const failAttempt = vi.fn(async () => undefined);
    const persistGenerated = vi.fn();
    const app = createBirdGenerationRoutes(
      dependencies({
        generateBird: async () => {
          throw new Error("gateway timeout");
        },
        failAttempt,
        persistGenerated,
      }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody(),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Couldn’t grow feathers this time. Try again.",
    });
    expect(failAttempt).toHaveBeenCalledWith("attempt-1");
    expect(persistGenerated).not.toHaveBeenCalled();
  });

  it("maps a generated-child uniqueness race to already transformed", async () => {
    const failAttempt = vi.fn(async () => undefined);
    const app = createBirdGenerationRoutes(
      dependencies({
        persistGenerated: async () => {
          throw new GeneratedAlreadyExistsError();
        },
        failAttempt,
      }),
    );

    const response = await app.request(
      "/identifications/source-1/make-bird",
      postBody(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This photo already has a fictional bird.",
    });
    expect(failAttempt).toHaveBeenCalledWith("attempt-1");
  });
});
