import { appHomeUrl } from "./base-path";
import { readExplicitAppView } from "./app-view";

export function googleSignInOptions(
  location: { origin: string; search?: string },
  basePath: string | undefined,
) {
  const callback = new URL(appHomeUrl(location.origin, basePath));
  const view = readExplicitAppView(location.search ?? "");
  if (view && view !== "identify") {
    callback.searchParams.set("view", view);
  }
  const callbackURL = callback.toString();
  return {
    provider: "google" as const,
    callbackURL,
    newUserCallbackURL: callbackURL,
    errorCallbackURL: callbackURL,
  };
}
