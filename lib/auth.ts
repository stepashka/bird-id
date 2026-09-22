import { createRemoteJWKSet, jwtVerify } from "jose";

export class AuthError extends Error {
  readonly status = 401 as const;
  constructor(message: string) {
    super(message);
  }
}

export async function resolveUserId(input: {
  authorization: string | undefined;
  invokeSecretHeader: string | undefined;
  userIdHeader: string | undefined;
  jwksUrl: string | undefined;
  invokeSecret: string | undefined;
}): Promise<string> {
  const bearer = input.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (input.invokeSecret && bearer === input.invokeSecret) {
    const userId = input.userIdHeader?.trim();
    if (!userId) {
      throw new AuthError("Sign in to identify a bird.");
    }
    return userId;
  }

  if (bearer && input.jwksUrl) {
    const jwks = createRemoteJWKSet(new URL(input.jwksUrl));
    const { payload } = await jwtVerify(bearer, jwks);
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    if (!sub) {
      throw new AuthError("Sign in to identify a bird.");
    }
    return sub;
  }

  throw new AuthError("Sign in to identify a bird.");
}
