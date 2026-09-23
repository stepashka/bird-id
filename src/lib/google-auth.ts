import { appHomeUrl } from "./base-path";

export function googleSignInOptions(
  location: { origin: string },
  basePath: string | undefined,
) {
  const callbackURL = appHomeUrl(location.origin, basePath);
  return {
    provider: "google" as const,
    callbackURL,
    newUserCallbackURL: callbackURL,
    errorCallbackURL: callbackURL,
  };
}
