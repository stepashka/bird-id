import { Hono } from "hono";
import { AuthError } from "../lib/auth";
import {
  createShareToken,
  hashShareToken,
  isValidShareToken,
  toPublicSighting,
  type SharedIdentificationRow,
} from "../lib/sharing";

export type ShareRouteDependencies = {
  resolveUserId(authorization: string | undefined): Promise<string>;
  createShare(input: {
    identificationId: string;
    userId: string;
    tokenHash: string;
  }): Promise<boolean>;
  revokeShares(input: {
    identificationId: string;
    userId: string;
  }): Promise<boolean>;
  findShared(tokenHash: string): Promise<SharedIdentificationRow | null>;
  signedPhotoUrl(objectKey: string): Promise<string>;
};

const UNAVAILABLE = {
  error: "This shared identification is unavailable.",
};

export function createShareRoutes(deps: ShareRouteDependencies) {
  const app = new Hono();

  app.post("/identifications/:id/shares", async (c) => {
    try {
      const userId = await deps.resolveUserId(c.req.header("Authorization"));
      const token = createShareToken();
      const created = await deps.createShare({
        identificationId: c.req.param("id"),
        userId,
        tokenHash: hashShareToken(token),
      });
      if (!created) {
        return c.json({ error: "Identification not found." }, 404);
      }
      return c.json({ token }, 201);
    } catch (error) {
      return shareFailure(c, error, "Could not create a share.");
    }
  });

  app.delete("/identifications/:id/shares", async (c) => {
    try {
      const userId = await deps.resolveUserId(c.req.header("Authorization"));
      const revoked = await deps.revokeShares({
        identificationId: c.req.param("id"),
        userId,
      });
      if (!revoked) {
        return c.json({ error: "Identification not found." }, 404);
      }
      return c.json({ ok: true });
    } catch (error) {
      return shareFailure(c, error, "Could not revoke shares.");
    }
  });

  app.get("/shares/:token", async (c) => {
    try {
      const token = c.req.param("token");
      if (!isValidShareToken(token)) {
        return c.json(UNAVAILABLE, 404);
      }
      const row = await deps.findShared(hashShareToken(token));
      if (!row) {
        return c.json(UNAVAILABLE, 404);
      }
      const photoUrl = await deps.signedPhotoUrl(row.object_key);
      return c.json(toPublicSighting(row, photoUrl));
    } catch (error) {
      return shareFailure(c, error, "Could not load the shared identification.");
    }
  });

  return app;
}

function shareFailure(
  c: { json: (object: unknown, status: 401 | 500) => Response },
  error: unknown,
  fallback: string,
) {
  if (error instanceof AuthError) {
    return c.json({ error: error.message }, error.status);
  }
  return c.json({ error: fallback }, 500);
}
