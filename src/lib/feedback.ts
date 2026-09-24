export const MAX_FEEDBACK_LENGTH = 4000;
export const MAX_FEEDBACK_SCREENSHOT_BYTES = 8 * 1024 * 1024;

const SCREENSHOT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function normalizeFeedbackMessage(value: string) {
  return value.trim();
}

export function feedbackMessageError(value: string): string | null {
  const message = normalizeFeedbackMessage(value);
  if (!message) {
    return "Tell us what happened or what you would improve.";
  }
  if (message.length > MAX_FEEDBACK_LENGTH) {
    return "Feedback must be 4,000 characters or fewer.";
  }
  return null;
}

export function feedbackScreenshotError(input: {
  size: number;
  type: string;
}): string | null {
  if (input.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
    return "Screenshots must be 8 MB or smaller.";
  }
  if (!SCREENSHOT_TYPES.has(input.type.toLowerCase())) {
    return "Use a JPEG, PNG, or WebP screenshot.";
  }
  return null;
}
