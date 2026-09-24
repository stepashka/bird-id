import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AuthError } from "../lib/auth";
import { feedbackScreenshotError } from "../lib/feedback";

const MAX_FEEDBACK_LENGTH = 4000;
const MAX_FEEDBACK_BODY_BYTES = 9 * 1024 * 1024;

export type FeedbackScreenshot = {
  bytes: Uint8Array;
  contentType: string;
};

export type FeedbackRouteDependencies = {
  resolveUserId(authorization: string | undefined): Promise<string>;
  saveFeedback(input: {
    userId: string;
    message: string;
    screenshot?: FeedbackScreenshot;
  }): Promise<{ id: string; createdAt: Date }>;
};

export function createFeedbackRoutes(deps: FeedbackRouteDependencies) {
  const app = new Hono();

  app.post(
    "/feedback",
    bodyLimit({
      maxSize: MAX_FEEDBACK_BODY_BYTES,
      onError: (c) =>
        c.json({ error: "Feedback attachments must be 8 MB or smaller." }, 413),
    }),
    async (c) => {
    try {
      const userId = await deps.resolveUserId(c.req.header("Authorization"));
      const form = await c.req.formData();
      const messageValue = form.get("message");
      const message =
        typeof messageValue === "string" ? messageValue.trim() : "";

      if (!message) {
        return c.json(
          { error: "Tell us what happened or what you would improve." },
          400,
        );
      }
      if (message.length > MAX_FEEDBACK_LENGTH) {
        return c.json(
          { error: "Feedback must be 4,000 characters or fewer." },
          400,
        );
      }

      const screenshotValue = form.get("screenshot");
      let screenshot: FeedbackScreenshot | undefined;
      if (screenshotValue instanceof File) {
        const contentType =
          screenshotValue.type || "application/octet-stream";
        const invalid = feedbackScreenshotError({
          size: screenshotValue.size,
          contentType,
        });
        if (invalid) {
          return c.json({ error: invalid }, 400);
        }
        if (screenshotValue.size > 0) {
          const bytes = new Uint8Array(await screenshotValue.arrayBuffer());
          screenshot = { bytes, contentType };
        }
      }

      const saved = await deps.saveFeedback({ userId, message, screenshot });
      return c.json(
        { id: saved.id, createdAt: saved.createdAt.toISOString() },
        201,
      );
    } catch (error) {
      if (error instanceof AuthError) {
        return c.json({ error: error.message }, error.status);
      }
      return c.json({ error: "Could not submit feedback." }, 500);
    }
    },
  );

  return app;
}
