import { describe, expect, it } from "vitest";
import { appViewUrl, readAppView, readExplicitAppView } from "./app-view";

describe("app view URLs", () => {
  it("opens a shared feedback return URL on Feedback", () => {
    expect(readAppView("?view=feedback")).toBe("feedback");
    expect(readExplicitAppView("?view=feedback")).toBe("feedback");
  });

  it("falls back safely for unknown views", () => {
    expect(readAppView("?view=admin")).toBe("identify");
    expect(readExplicitAppView("?view=admin")).toBeNull();
  });

  it("adds and removes the view without losing unrelated parameters", () => {
    const location = {
      pathname: "/bird-id/",
      search: "?source=email",
      hash: "#top",
    };
    expect(appViewUrl(location, "feedback")).toBe(
      "/bird-id/?source=email&view=feedback#top",
    );
    expect(
      appViewUrl(
        { ...location, search: "?source=email&view=feedback" },
        "identify",
      ),
    ).toBe("/bird-id/?source=email#top");
  });
});
