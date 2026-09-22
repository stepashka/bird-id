type ShareLocation = {
  origin: string;
  pathname: string;
};

type ShareData = {
  title?: string;
  text?: string;
  url?: string;
};

type ShareLinkOptions = {
  url: string;
  title?: string;
  text?: string;
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
};

export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";

export function shareMessage(outcome: ShareOutcome): string | null {
  if (outcome === "copied") return "Link copied.";
  if (outcome === "manual") return "Copy this link:";
  return null;
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
  text,
  share,
  writeText,
}: ShareLinkOptions): Promise<ShareOutcome> {
  if (share) {
    try {
      await share({ title, text, url });
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
