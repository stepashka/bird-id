export function googleSignInOptions(location: { href: string }) {
  return {
    provider: "google" as const,
    callbackURL: location.href,
  };
}
