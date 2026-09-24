import { neon } from "@neon/ai-sdk-provider";
import { generateObject, streamText } from "ai";
import sharp from "sharp";
import { z } from "zod";
import { buildBirdEditPrompt } from "./bird-generation";

export type GeneratedBird = {
  bytes: Uint8Array;
  contentType: "image/jpeg";
  commonName: string;
  scientificName: string;
};

export type BirdGenerationRunners = {
  editImage(input: {
    source: Uint8Array;
    contentType: string;
    prompt: string;
  }): Promise<Uint8Array>;
  nameImage(image: Uint8Array): Promise<{
    commonName: string;
    scientificName: string;
  }>;
};

const fictionalNameSchema = z.object({
  commonName: z.string().min(2).max(80),
  scientificName: z.string().min(2).max(100),
});

const FALLBACK_NAME = {
  commonName: "Mystery Bird",
  scientificName: "Aves imaginaria",
};

export const IMAGE_GENERATION_OPTIONS = {
  outputFormat: "jpeg",
  outputCompression: 82,
  quality: "medium",
  size: "1024x1024",
  moderation: "auto",
} as const;

export function createBirdGenerator(runners: BirdGenerationRunners) {
  return async (input: {
    source: Uint8Array;
    contentType: string;
    preference?: string;
  }): Promise<GeneratedBird> => {
    const bytes = await runners.editImage({
      source: input.source,
      contentType: input.contentType,
      prompt: buildBirdEditPrompt(input.preference),
    });
    if (bytes.byteLength === 0) {
      throw new Error("Image generation did not return image bytes.");
    }

    const names = await runners.nameImage(bytes).catch(() => FALLBACK_NAME);
    return {
      bytes,
      contentType: "image/jpeg",
      ...names,
    };
  };
}

async function editImageWithNeon(input: {
  source: Uint8Array;
  contentType: string;
  prompt: string;
}) {
  const result = streamText({
    model: neon(process.env.NEON_IMAGE_MODEL || "gpt-5-mini"),
    tools: {
      image_generation: neon.tools.imageGeneration(IMAGE_GENERATION_OPTIONS),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: Buffer.from(input.source),
            mediaType: input.contentType,
          },
          { type: "text", text: input.prompt },
        ],
      },
    ],
  });

  let encoded: string | undefined;
  for await (const part of result.fullStream) {
    if (part.type !== "tool-result" || part.toolName !== "image_generation") {
      continue;
    }
    const output = part.output;
    if (
      output &&
      typeof output === "object" &&
      "result" in output &&
      typeof output.result === "string" &&
      output.result
    ) {
      encoded = output.result;
    }
  }
  if (!encoded) {
    throw new Error("Image generation did not return image bytes.");
  }

  return new Uint8Array(
    await sharp(Buffer.from(encoded, "base64"), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        width: 1536,
        height: 1536,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
  );
}

async function nameImageWithNeon(image: Uint8Array) {
  const result = await generateObject({
    model: neon(process.env.NEON_AI_MODEL || "gpt-5-4-mini"),
    schema: fictionalNameSchema,
    system:
      "Invent a whimsical common name and Latin-style scientific name for " +
      "this AI-generated fictional bird. The names must be clearly invented; " +
      "do not claim it is a real species. Return only the requested fields.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: Buffer.from(image),
            mediaType: "image/jpeg",
          },
          {
            type: "text",
            text: "Name this fictional bird.",
          },
        ],
      },
    ],
  });
  return result.object;
}

export const generateBirdTransformation = createBirdGenerator({
  editImage: editImageWithNeon,
  nameImage: nameImageWithNeon,
});
