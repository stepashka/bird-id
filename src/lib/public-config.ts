type PublicEnv = {
  VITE_NEON_AUTH_URL?: string;
  VITE_NEON_FUNCTION_API_URL?: string;
};

export function readPublicConfig(env: PublicEnv) {
  const authUrl = env.VITE_NEON_AUTH_URL?.trim();
  const functionUrl = env.VITE_NEON_FUNCTION_API_URL?.trim().replace(/\/$/, "");

  if (!authUrl || !functionUrl) {
    throw new Error(
      "VITE_NEON_AUTH_URL and VITE_NEON_FUNCTION_API_URL are required.",
    );
  }

  return { authUrl, functionUrl };
}
