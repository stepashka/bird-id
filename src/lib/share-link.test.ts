import { describe, expect, it, vi } from "vitest";
import { buildShareUrl, readShareToken, shareLink } from "./share-link";

describe("readShareToken", () => {
  it("reads the share token from the query string", () => {
    expect(readShareToken("?share=abc")).toBe("abc");
  });

  it("returns null when the query string has no share token", () => {
    expect(readShareToken("?other=abc")).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("builds a share URL at the current application path", () => {
    expect(
      buildShareUrl(
        { origin: "https://stepashka.github.io", pathname: "/bird-id/" },
        "abc",
      ),
    ).toBe("https://stepashka.github.io/bird-id/?share=abc");
  });

  it("encodes the token with URL search parameters", () => {
    expect(
      buildShareUrl(
        { origin: "https://example.com", pathname: "/" },
        "a token&value",
      ),
    ).toBe("https://example.com/?share=a+token%26value");
  });
});

describe("shareLink", () => {
  it("uses native sharing when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();

    await expect(
      shareLink({ url: "https://example/share", share, writeText }),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example/share" }),
    );
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareLink({ url: "https://example/share", writeText }),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example/share");
  });

  it("returns cancelled when native sharing is aborted", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("The request was cancelled.", "AbortError"),
    );
    const writeText = vi.fn();

    await expect(
      shareLink({ url: "https://example/share", share, writeText }),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("returns manual when clipboard writing fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));

    await expect(
      shareLink({ url: "https://example/share", writeText }),
    ).resolves.toBe("manual");
  });
});
