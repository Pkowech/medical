export const FILE_STORAGE = 'IFileStorage';

export interface IFileStorage {
  uploadBuffer(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<any>;

  getPresignedDownloadUrl(
    key: string,
    options?: {
      filename?: string;
      contentType?: string;
      inline?: boolean;
    },
  ): Promise<string>;

  getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ): Promise<string>;

  deleteObject(key: string): Promise<any>;

  downloadBuffer(key: string): Promise<Buffer>;
}
