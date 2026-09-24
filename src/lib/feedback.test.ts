import { describe, expect, it } from "vitest";
import {
  feedbackMessageError,
  feedbackScreenshotError,
  normalizeFeedbackMessage,
} from "./feedback";

describe("feedback message validation", () => {
  it("requires a message", () => {
    expect(feedbackMessageError("   ")).toBe(
      "Tell us what happened or what you would improve.",
    );
  });

  it("limits feedback to 4000 characters", () => {
    expect(feedbackMessageError("a".repeat(4001))).toBe(
      "Feedback must be 4,000 characters or fewer.",
    );
  });

  it("trims a valid message", () => {
    expect(feedbackMessageError("  Helpful note  ")).toBeNull();
    expect(normalizeFeedbackMessage("  Helpful note  ")).toBe("Helpful note");
  });
});

describe("feedback screenshot validation", () => {
  it("rejects oversized and unsupported screenshots before upload", () => {
    expect(
      feedbackScreenshotError({
        size: 8 * 1024 * 1024 + 1,
        type: "image/png",
      }),
    ).toBe("Screenshots must be 8 MB or smaller.");
    expect(feedbackScreenshotError({ size: 10, type: "image/gif" })).toBe(
      "Use a JPEG, PNG, or WebP screenshot.",
    );
  });

  it("accepts supported screenshot metadata", () => {
    expect(feedbackScreenshotError({ size: 10, type: "image/webp" })).toBeNull();
  });
});
