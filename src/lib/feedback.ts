export const MAX_FEEDBACK_LENGTH = 4000;

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
