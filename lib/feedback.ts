export function feedbackScreenshotKey(
  userId: string,
  contentType: string,
): string {
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}
