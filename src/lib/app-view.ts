export type AppView = "identify" | "log" | "feedback";

type ViewLocation = {
  pathname: string;
  search: string;
  hash: string;
};

function isAppView(value: string | null): value is AppView {
  return value === "identify" || value === "log" || value === "feedback";
}

export function readExplicitAppView(search: string): AppView | null {
  const value = new URLSearchParams(search).get("view");
  return isAppView(value) ? value : null;
}

export function readAppView(search: string): AppView {
  return readExplicitAppView(search) ?? "identify";
}

export function appViewUrl(location: ViewLocation, view: AppView): string {
  const search = new URLSearchParams(location.search);
  if (view === "identify") {
    search.delete("view");
  } else {
    search.set("view", view);
  }
  const query = search.toString();
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
