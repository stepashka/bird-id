import { describe, expect, it } from "vitest";
import { AuthError, resolveUserId } from "./auth";

describe("resolveUserId", () => {
  it("accepts the Next.js invoke secret plus user id", async () => {
    await expect(
      resolveUserId({
        authorization: "Bearer test-secret",
        invokeSecretHeader: undefined,
        userIdHeader: "user-123",
        jwksUrl: undefined,
        invokeSecret: "test-secret",
      }),
    ).resolves.toBe("user-123");
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
