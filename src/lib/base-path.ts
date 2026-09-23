export function normalizeBasePath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

export function appHomeUrl(origin: string, basePath: string | undefined) {
  return new URL(normalizeBasePath(basePath), origin).toString();
}
