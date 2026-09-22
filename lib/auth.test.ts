import { describe, expect, it } from "vitest";
import { AuthError, resolveUserId } from "./auth";

describe("resolveUserId", () => {
  it("rejects the legacy invoke secret and user-id headers", async () => {
    await expect(
      resolveUserId({
        authorization: "Bearer test-secret",
        invokeSecretHeader: undefined,
        userIdHeader: "user-123",
        jwksUrl: undefined,
        invokeSecret: "test-secret",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects a missing session", async () => {
    await expect(
      resolveUserId({
        authorization: undefined,
        invokeSecretHeader: undefined,
        userIdHeader: undefined,
        jwksUrl: undefined,
        invokeSecret: "test-secret",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
