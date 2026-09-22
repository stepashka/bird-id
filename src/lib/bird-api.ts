import { auth } from "@/lib/auth/server";

export type FunctionJson = {
  error?: string;
  [key: string]: unknown;
};

export async function callBirdApi(path: string, init?: RequestInit) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return { status: 401, body: { error: "Sign in to identify a bird." } as FunctionJson };
  }

  const baseUrl =
    process.env.NEON_FUNCTION_API_BASE_URL ||
    process.env.NEON_FUNCTIONS_API_BASE_URL;
  const secret = process.env.FUNCTION_INVOKE_SECRET;
  if (!baseUrl || !secret) {
    return {
      status: 503,
      body: {
        error:
          "Neon backend is not linked yet. Run neon login, neon link, then neon deploy.",
      } as FunctionJson,
    };
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  headers.set("X-User-Id", session.user.id);

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json()) as FunctionJson;
  return { status: response.status, body };
}
