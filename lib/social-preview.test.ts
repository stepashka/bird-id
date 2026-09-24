import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MAX_SOCIAL_PREVIEW_BYTES,
  renderSocialPreview,
  socialPreviewKey,
} from "./social-preview";

describe("social preview images", () => {
  it("creates a 1200 by 630 JPEG within the transfer budget", async () => {
    const width = 1600;
    const height = 1000;
    const pixels = Buffer.alloc(width * height * 3);
    let state = 123456789;
    for (let index = 0; index < pixels.length; index += 1) {
      state = (1103515245 * state + 12345) & 0x7fffffff;
      pixels[index] = state & 0xff;
    }
    const source = await sharp(pixels, {
      raw: { width, height, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    const preview = await renderSocialPreview(source);
    const metadata = await sharp(preview).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(preview.byteLength).toBeLessThanOrEqual(MAX_SOCIAL_PREVIEW_BYTES);
  });

  it("uses a non-secret token hash as the private object key", () => {
    expect(socialPreviewKey("a".repeat(64))).toBe(
      `previews/${"a".repeat(64)}.jpg`,
    );
  });
});
