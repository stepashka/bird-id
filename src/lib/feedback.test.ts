import { describe, expect, it } from "vitest";
import { feedbackMessageError, normalizeFeedbackMessage } from "./feedback";

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
