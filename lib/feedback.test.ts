import { describe, expect, it, vi } from "vitest";
import {
  feedbackScreenshotError,
  feedbackScreenshotKey,
  persistFeedback,
} from "./feedback";

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

describe("feedbackScreenshotError", () => {
  it("treats an empty optional screenshot as absent", () => {
    expect(feedbackScreenshotError({ size: 0, contentType: "" })).toBeNull();
  });

  it("uses screenshot-specific size and type messages", () => {
    expect(
      feedbackScreenshotError({
        size: 8 * 1024 * 1024 + 1,
        contentType: "image/png",
      }),
    ).toBe("Screenshots must be 8 MB or smaller.");
    expect(
      feedbackScreenshotError({ size: 10, contentType: "image/gif" }),
    ).toBe("Use a JPEG, PNG, or WebP screenshot.");
  });
});

describe("persistFeedback", () => {
  it("removes both the row and screenshot if attachment fails", async () => {
    const deleteFeedback = vi.fn(async () => undefined);
    const deleteScreenshot = vi.fn(async () => undefined);
    const key = "user-1/screen.png";

    await expect(
      persistFeedback(
        {
          insertFeedback: async () => ({
            id: "feedback-1",
            createdAt: new Date("2026-09-24T09:00:00Z"),
          }),
          uploadScreenshot: async () => undefined,
          attachScreenshot: async () => {
            throw new Error("database unavailable");
          },
          deleteFeedback,
          deleteScreenshot,
          screenshotKey: () => key,
        },
        {
          userId: "user-1",
          message: "The form broke.",
          screenshot: {
            bytes: new Uint8Array([1, 2, 3]),
            contentType: "image/png",
          },
        },
      ),
    ).rejects.toThrow("database unavailable");

    expect(deleteScreenshot).toHaveBeenCalledWith(key);
    expect(deleteFeedback).toHaveBeenCalledWith("feedback-1");
  });
});
