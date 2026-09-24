import { describe, expect, it, vi } from "vitest";
import { AuthError } from "../lib/auth";
import {
  createFeedbackRoutes,
  type FeedbackRouteDependencies,
} from "./feedback-routes";

function fakeDependencies(
  overrides: Partial<FeedbackRouteDependencies> = {},
): FeedbackRouteDependencies {
  return {
    resolveUserId: async () => "user-1",
    saveFeedback: async () => ({
      id: "feedback-1",
      createdAt: new Date("2026-09-24T09:00:00Z"),
    }),
    ...overrides,
  };
}

function requestForm(message: string, screenshot?: File) {
  const body = new FormData();
  body.set("message", message);
  if (screenshot) body.set("screenshot", screenshot);
  return {
    method: "POST",
    headers: { Authorization: "Bearer user-jwt" },
    body,
  };
}

describe("feedback routes", () => {
  it("requires an authenticated user", async () => {
    const app = createFeedbackRoutes(
      fakeDependencies({
        resolveUserId: async () => {
          throw new AuthError("Sign in to send feedback.");
        },
      }),
    );

    const response = await app.request("/feedback", requestForm("Helpful note"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Sign in to send feedback.",
    });
  });

  it("requires a non-empty message", async () => {
    const saveFeedback = vi.fn();
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));

    const response = await app.request("/feedback", requestForm("   "));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Tell us what happened or what you would improve.",
    });
    expect(saveFeedback).not.toHaveBeenCalled();
  });

  it("rejects messages longer than 4000 characters", async () => {
    const app = createFeedbackRoutes(fakeDependencies());

    const response = await app.request(
      "/feedback",
      requestForm("a".repeat(4001)),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Feedback must be 4,000 characters or fewer.",
    });
  });

  it("submits text-only feedback", async () => {
    const saveFeedback = vi.fn(fakeDependencies().saveFeedback);
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));

    const response = await app.request(
      "/feedback",
      requestForm("  The share flow is useful.  "),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "feedback-1",
      createdAt: "2026-09-24T09:00:00.000Z",
    });
    expect(saveFeedback).toHaveBeenCalledWith({
      userId: "user-1",
      message: "The share flow is useful.",
      screenshot: undefined,
    });
  });

  it("submits an optional valid screenshot", async () => {
    const saveFeedback = vi.fn(fakeDependencies().saveFeedback);
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));
    const screenshot = new File([new Uint8Array([1, 2, 3])], "screen.png", {
      type: "image/png",
    });

    const response = await app.request(
      "/feedback",
      requestForm("This screen was confusing.", screenshot),
    );

    expect(response.status).toBe(201);
    expect(saveFeedback).toHaveBeenCalledWith({
      userId: "user-1",
      message: "This screen was confusing.",
      screenshot: {
        bytes: expect.any(Uint8Array),
        contentType: "image/png",
      },
    });
  });

  it("treats an empty optional screenshot as omitted", async () => {
    const saveFeedback = vi.fn(fakeDependencies().saveFeedback);
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));
    const screenshot = new File([], "screen.png", { type: "image/png" });

    const response = await app.request(
      "/feedback",
      requestForm("Text feedback still matters.", screenshot),
    );

    expect(response.status).toBe(201);
    expect(saveFeedback).toHaveBeenCalledWith({
      userId: "user-1",
      message: "Text feedback still matters.",
      screenshot: undefined,
    });
  });

  it("rejects an oversized screenshot before submission", async () => {
    const saveFeedback = vi.fn();
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));
    const screenshot = new File(
      [new Uint8Array(8 * 1024 * 1024 + 1)],
      "screen.png",
      { type: "image/png" },
    );

    const response = await app.request(
      "/feedback",
      requestForm("Large screenshot.", screenshot),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Screenshots must be 8 MB or smaller.",
    });
    expect(saveFeedback).not.toHaveBeenCalled();
  });

  it("rejects an unsupported screenshot type", async () => {
    const saveFeedback = vi.fn();
    const app = createFeedbackRoutes(fakeDependencies({ saveFeedback }));
    const screenshot = new File(["not an image"], "screen.gif", {
      type: "image/gif",
    });

    const response = await app.request(
      "/feedback",
      requestForm("See screenshot.", screenshot),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Use a JPEG, PNG, or WebP screenshot.",
    });
    expect(saveFeedback).not.toHaveBeenCalled();
  });
});
