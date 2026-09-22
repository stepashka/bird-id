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

export function readShareToken(search: string): string | null {
  return new URLSearchParams(search).get("share");
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
}: ShareLinkOptions): Promise<"shared" | "copied" | "manual" | "cancelled"> {
  if (share) {
    try {
      await share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      return "manual";
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
