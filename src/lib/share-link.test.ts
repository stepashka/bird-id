import { describe, expect, it, vi } from "vitest";
import {
  buildShareUrl,
  readShareToken,
  shareLink,
  shareMessage,
  ownerShareUrl,
} from "./share-link";

describe("shareMessage", () => {
  it("maps share outcomes to owner feedback", () => {
    expect(shareMessage("shared")).toBeNull();
    expect(shareMessage("copied")).toBe("Link copied.");
    expect(shareMessage("manual")).toBe("Copy this link:");
    expect(shareMessage("cancelled")).toBeNull();
  });
});

describe("ownerShareUrl", () => {
  it("keeps a generated share URL visible after share", () => {
    expect(ownerShareUrl("https://stepashka.github.io/bird-id/?share=abc")).toBe(
      "https://stepashka.github.io/bird-id/?share=abc",
    );
  });

  it("hides the field when no URL was generated this session", () => {
    expect(ownerShareUrl("")).toBeNull();
  });
});

describe("readShareToken", () => {
  it("reads the share token from the query string", () => {
    expect(readShareToken("?share=abc")).toBe("abc");
  });

  it("returns null when the query string has no share token", () => {
    expect(readShareToken("?other=abc")).toBeNull();
  });

  it("returns null when the share parameter is empty", () => {
    expect(readShareToken("?share=")).toBeNull();
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

  it("omits descriptive text from the native share payload", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    const options = {
      url: "http://127.0.0.1:5173/?share=token43charsxxxxxxxxxxxxxxxxxxxxxxx",
      title: "Rose-ringed Parakeet",
      text: "A bird identification from Fieldmark: Rose-ringed Parakeet",
      share,
      writeText,
    };

    await expect(shareLink(options)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toEqual({
      title: "Rose-ringed Parakeet",
      url: "http://127.0.0.1:5173/?share=token43charsxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty("text");
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

  it("treats any AbortError-named rejection as cancellation", async () => {
    const share = vi.fn().mockRejectedValue({ name: "AbortError" });
    const writeText = vi.fn();

    await expect(
      shareLink({ url: "https://example/share", share, writeText }),
    ).resolves.toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies when native sharing fails for a non-cancellation reason", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share unavailable"));
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareLink({ url: "https://example/share", share, writeText }),
    ).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example/share");
  });

  it("returns manual when native sharing and clipboard both fail", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share unavailable"));
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));

    await expect(
      shareLink({ url: "https://example/share", share, writeText }),
    ).resolves.toBe("manual");
  });

  it("returns manual when clipboard writing fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Not allowed"));

    await expect(
      shareLink({ url: "https://example/share", writeText }),
    ).resolves.toBe("manual");
  });
});
