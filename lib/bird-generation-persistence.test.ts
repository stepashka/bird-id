import { describe, expect, it, vi } from "vitest";
import { persistGeneratedAsset } from "./bird-generation-persistence";

const generated = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  contentType: "image/jpeg" as const,
  commonName: "Velvet Teapot Finch",
  scientificName: "Theiera velutina",
};

describe("persistGeneratedAsset", () => {
  it("does not delete a committed photo when URL signing fails", async () => {
    const deleteObject = vi.fn(async () => undefined);
    const persist = persistGeneratedAsset({
      createObjectKey: () => "generated/user/result.jpg",
      uploadObject: async () => undefined,
      commitRecord: async () => ({ id: "generated-1" }),
      signObject: async () => {
        throw new Error("signing unavailable");
      },
      deleteObject,
    });

    await expect(persist({ generated })).rejects.toThrow("signing unavailable");
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("deletes an uploaded photo when the database commit fails", async () => {
    const deleteObject = vi.fn(async () => undefined);
    const persist = persistGeneratedAsset({
      createObjectKey: () => "generated/user/result.jpg",
      uploadObject: async () => undefined,
      commitRecord: async () => {
        throw new Error("insert failed");
      },
      signObject: async () => "https://signed.example/generated",
      deleteObject,
    });

    await expect(persist({ generated })).rejects.toThrow("insert failed");
    expect(deleteObject).toHaveBeenCalledWith("generated/user/result.jpg");
  });
});
