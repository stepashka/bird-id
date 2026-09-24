import { describe, expect, it, vi } from "vitest";
import { feedbackScreenshotKey } from "./feedback";

describe("feedbackScreenshotKey", () => {
  it("uses the feedback user's private prefix and matching extension", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "123e4567-e89b-12d3-a456-426614174000",
    );

    expect(feedbackScreenshotKey("user-1", "image/png")).toBe(
      "user-1/123e4567-e89b-12d3-a456-426614174000.png",
    );
  });
});
