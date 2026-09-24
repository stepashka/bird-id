type GeneratedAsset = {
  bytes: Uint8Array;
  contentType: string;
};

type PersistenceDependencies<Input, Record> = {
  createObjectKey: (input: Input) => string;
  uploadObject: (
    objectKey: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<void>;
  commitRecord: (objectKey: string, input: Input) => Promise<Record>;
  signObject: (objectKey: string) => Promise<string>;
  deleteObject: (objectKey: string) => Promise<void>;
};

export function persistGeneratedAsset<
  Input extends { generated: GeneratedAsset },
  Record,
>(dependencies: PersistenceDependencies<Input, Record>) {
  return async (input: Input) => {
    const objectKey = dependencies.createObjectKey(input);
    await dependencies.uploadObject(
      objectKey,
      input.generated.bytes,
      input.generated.contentType,
    );

    let record: Record;
    try {
      record = await dependencies.commitRecord(objectKey, input);
    } catch (error) {
      await dependencies.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }

    return {
      record,
      objectKey,
      photoUrl: await dependencies.signObject(objectKey),
    };
  };
}
