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
  publicAppUrl: string;
  getPreviewPhoto(previewKey: string): Promise<{
    body: Uint8Array;
    contentType: string;
  } | null>;
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
      return c.json(
        {
          token,
          url: new URL(`/s/${token}`, c.req.url).toString(),
        },
        201,
      );
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

  app.get("/s/:token", async (c) => {
    try {
      const token = c.req.param("token");
      const row = await findSocialShare(deps, token);
      if (!row) {
        return c.html(
          "<h1>This shared identification is unavailable.</h1>",
          404,
          socialHeaders(),
        );
      }
      return c.html(
        socialShareHtml(row, token, c.req.url, deps.publicAppUrl),
        200,
        socialHeaders(),
      );
    } catch (error) {
      return shareFailure(c, error, "Could not load the shared identification.");
    }
  });

  app.get("/s/:token/photo", async (c) => {
    try {
      const token = c.req.param("token");
      const row = await findSocialShare(deps, token);
      if (!row) {
        return c.json(UNAVAILABLE, 404);
      }
      const photo = await deps.getPreviewPhoto(row.preview_key);
      if (!photo) {
        return c.json(UNAVAILABLE, 404);
      }
      return c.body(photo.body.slice().buffer, 200, {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
    } catch (error) {
      return shareFailure(c, error, "Could not load the shared identification.");
    }
  });

  return app;
}

async function findSocialShare(
  deps: ShareRouteDependencies,
  token: string,
): Promise<(SharedIdentificationRow & { preview_key: string }) | null> {
  if (!isValidShareToken(token)) return null;
  const row = await deps.findShared(hashShareToken(token));
  return row?.preview_key ? { ...row, preview_key: row.preview_key } : null;
}

function socialShareHtml(
  row: SharedIdentificationRow,
  token: string,
  requestUrl: string,
  publicAppUrl: string,
) {
  const title = escapeHtml(row.common_name);
  const description = escapeHtml(
    `${row.scientific_name} · Identified with Fieldmark`,
  );
  const pageUrl = new URL(`/s/${token}`, requestUrl).toString();
  const photoUrl = new URL(`/s/${token}/photo`, requestUrl).toString();
  const appUrl = new URL(publicAppUrl);
  appUrl.searchParams.set("share", token);
  const safeAppUrl = escapeHtml(appUrl.toString());
  const redirectScript = JSON.stringify(appUrl.toString()).replace(
    /</g,
    "\\u003c",
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Fieldmark</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Fieldmark">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(photoUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${escapeHtml(photoUrl)}">
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p><i>${escapeHtml(row.scientific_name)}</i></p>
    <p><a href="${safeAppUrl}">View this identification on Fieldmark</a></p>
  </main>
  <script>window.location.replace(${redirectScript})</script>
</body>
</html>`;
}

function socialHeaders() {
  return {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex",
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
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
