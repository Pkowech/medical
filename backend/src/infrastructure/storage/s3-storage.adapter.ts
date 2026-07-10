import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';
import { IFileStorage } from './file-storage.interface';

@Injectable()
export class S3StorageAdapter implements IFileStorage {
  constructor(private readonly storageService: StorageService) {}

  uploadBuffer(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ) {
    return this.storageService.uploadBuffer(key, buffer, contentType, metadata);
  }

  getPresignedDownloadUrl(
    key: string,
    options?: {
      filename?: string;
      contentType?: string;
      inline?: boolean;
    },
  ) {
    return this.storageService.getPresignedDownloadUrl(key, options);
  }

  getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ) {
    return this.storageService.getPresignedUploadUrl(
      key,
      contentType,
      contentLength,
    );
  }

  deleteObject(key: string) {
    return this.storageService.deleteObject(key);
  }

  downloadBuffer(key: string) {
    return this.storageService.downloadBuffer(key);
  }
}
