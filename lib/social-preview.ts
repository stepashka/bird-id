import sharp from "sharp";

export const MAX_SOCIAL_PREVIEW_BYTES = 300 * 1024;

const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;
const JPEG_QUALITIES = [72, 60, 48, 36, 28];

export function socialPreviewKey(tokenHash: string) {
  return `previews/${tokenHash}.jpg`;
}

export async function renderSocialPreview(
  source: Uint8Array | Buffer,
): Promise<Buffer> {
  for (const quality of JPEG_QUALITIES) {
    const preview = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, {
        fit: "contain",
        background: "#f2efe6",
      })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();

    if (preview.byteLength <= MAX_SOCIAL_PREVIEW_BYTES) {
      return preview;
    }
  }

  throw new Error("Could not fit the social preview within 300 KB.");
}
