export type BirdApiOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
};

export type PublicBirdApiOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "The bird service could not complete the request.");
  }

  return body;
}

export function createBirdApi({
  baseUrl,
  getToken,
  fetcher = fetch,
}: BirdApiOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const token = await getToken();
      if (!token) {
        throw new Error("Sign in to identify a bird.");
      }

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);

      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        ...init,
        method: init.method ?? "GET",
        headers,
      });
      return parseResponse<T>(response);
    },
  };
}

export function createPublicBirdApi({
  baseUrl,
  fetcher = fetch,
}: PublicBirdApiOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers = new Headers(init.headers);
      headers.delete("Authorization");

      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        ...init,
        method: init.method ?? "GET",
        headers,
      });
      return parseResponse<T>(response);
    },
  };
}
