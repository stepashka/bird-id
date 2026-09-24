import { describe, expect, it, vi } from "vitest";
import { createBirdGenerator } from "./bird-generation-ai";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("createBirdGenerator", () => {
  it("passes the source image and fixed prompt to the editor", async () => {
    const editImage = vi.fn(async () => JPEG);
    const generate = createBirdGenerator({
      editImage,
      nameImage: async () => ({
        commonName: "Velvet Teapot Finch",
        scientificName: "Theiera velutina",
      }),
    });
    const source = new Uint8Array([1, 2, 3]);

    await generate({
      source,
      contentType: "image/png",
      preference: "blue tail",
    });

    expect(editImage).toHaveBeenCalledWith({
      source,
      contentType: "image/png",
      prompt: expect.stringContaining(
        "<creative-preference>blue tail</creative-preference>",
      ),
    });
  });

  it("returns the generated JPEG and fictional names", async () => {
    const generate = createBirdGenerator({
      editImage: async () => JPEG,
      nameImage: async () => ({
        commonName: "Velvet Teapot Finch",
        scientificName: "Theiera velutina",
      }),
    });

    await expect(
      generate({
        source: new Uint8Array([1]),
        contentType: "image/jpeg",
      }),
    ).resolves.toEqual({
      bytes: JPEG,
      contentType: "image/jpeg",
      commonName: "Velvet Teapot Finch",
      scientificName: "Theiera velutina",
    });
  });

  it("uses explicitly fictional fallback names when naming fails", async () => {
    const generate = createBirdGenerator({
      editImage: async () => JPEG,
      nameImage: async () => {
        throw new Error("naming unavailable");
      },
    });

    await expect(
      generate({
        source: new Uint8Array([1]),
        contentType: "image/jpeg",
      }),
    ).resolves.toMatchObject({
      commonName: "Mystery Bird",
      scientificName: "Aves imaginaria",
    });
  });

  it("rejects an empty image before attempting to name it", async () => {
    const nameImage = vi.fn();
    const generate = createBirdGenerator({
      editImage: async () => new Uint8Array(),
      nameImage,
    });

    await expect(
      generate({
        source: new Uint8Array([1]),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow("Image generation did not return image bytes.");
    expect(nameImage).not.toHaveBeenCalled();
  });
});
