import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BIRDS_BUCKET = "birds";
const SCREENS_BUCKET = "screens";
const PREVIEWS_BUCKET = "previews";

function s3() {
  return new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function readObject(bucket: string, key: string) {
  const result = await s3().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  if (!result.Body) {
    throw new Error("Stored image body is unavailable.");
  }
  return new Uint8Array(await result.Body.transformToByteArray());
}

export async function uploadPhoto(key: string, body: Buffer, contentType: string) {
  await uploadObject(BIRDS_BUCKET, key, body, contentType);
}

export async function deletePhoto(key: string) {
  await s3().send(
    new DeleteObjectCommand({
      Bucket: BIRDS_BUCKET,
      Key: key,
    }),
  );
}

export async function uploadFeedbackScreenshot(
  key: string,
  body: Buffer,
  contentType: string,
) {
  await uploadObject(SCREENS_BUCKET, key, body, contentType);
}

export async function deleteFeedbackScreenshot(key: string) {
  await s3().send(
    new DeleteObjectCommand({
      Bucket: SCREENS_BUCKET,
      Key: key,
    }),
  );
}

export async function readPhoto(key: string) {
  return readObject(BIRDS_BUCKET, key);
}

export async function uploadSocialPreview(
  key: string,
  body: Uint8Array,
  contentType: "image/jpeg",
) {
  await uploadObject(PREVIEWS_BUCKET, key, Buffer.from(body), contentType);
}

export async function readSocialPreview(key: string) {
  try {
    return {
      body: await readObject(PREVIEWS_BUCKET, key),
      contentType: "image/jpeg",
    };
  } catch (error) {
    if (isObjectNotFound(error)) return null;
    throw error;
  }
}

export async function deleteSocialPreview(key: string) {
  await s3().send(
    new DeleteObjectCommand({
      Bucket: PREVIEWS_BUCKET,
      Key: key,
    }),
  );
}

export async function signedPhotoUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: BIRDS_BUCKET, Key: key }),
    { expiresIn },
  );
}

function isObjectNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound"
  );
}
