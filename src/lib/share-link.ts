type ShareLocation = {
  origin: string;
  pathname: string;
};

type ShareData = {
  title?: string;
  url?: string;
};

type ShareLinkOptions = {
  url: string;
  title?: string;
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";

export function shareMessage(outcome: ShareOutcome): string | null {
  if (outcome === "copied") return "Link copied.";
  if (outcome === "manual") return "Copy this link:";
  return null;
}

export function ownerShareUrl(url: string) {
  return url || null;
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError",
  );
}

export function readShareToken(search: string): string | null {
  return new URLSearchParams(search).get("share") || null;
}

export function buildShareUrl(location: ShareLocation, token: string): string {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set("share", token);
  return url.toString();
}

export async function shareLink({
  url,
  title,
  share,
  writeText,
}: ShareLinkOptions): Promise<ShareOutcome> {
  if (share) {
    try {
      const data: ShareData = { url };
      if (title) data.title = title;
      await share(data);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) {
        return "cancelled";
      }
    }
  }

  if (writeText) {
    try {
      await writeText(url);
      return "copied";
    } catch {
      return "manual";
    }
  }

  return "manual";
}
