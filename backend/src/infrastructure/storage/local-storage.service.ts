import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileStorage } from './file-storage.interface';

@Injectable()
export class LocalStorageService implements IFileStorage {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath =
      this.configService.get<string>('LOCAL_STORAGE_PATH') ||
      'C:\\Users\\user\\PHARMACY';
  }

  private resolveLocalPath(key: string) {
    // If key looks like local:<hash> we don't map to a file system path
    if (key.startsWith('local:')) {
      return null;
    }
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(path.resolve(this.basePath))) {
      throw new Error('Attempt to access outside local storage path');
    }
    return resolved;
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer | Uint8Array,
    _contentType: string,
    _metadata?: Record<string, string>,
  ) {
    const target = this.resolveLocalPath(key);
    if (!target) {
      // For keys like local:<hash> we treat upload as noop — caller should manage file placement
      this.logger.warn('uploadBuffer called for local:<hash> key — noop', {
        key,
      });
      return true;
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(buffer));
    this.logger.log('Wrote local file', {
      target,
      size: Buffer.byteLength(Buffer.from(buffer)),
    });
    return true;
  }

  getPresignedDownloadUrl(
    key: string,
    _options?: {
      filename?: string;
      contentType?: string;
      inline?: boolean;
    },
  ): Promise<string> {
    // For local keys created by registerLocalMaterial we use /api/materials/local/serve/{hash}
    if (key.startsWith('local:')) {
      const hash = key.slice('local:'.length);
      return Promise.resolve(
        `/v1/materials/local/serve/${encodeURIComponent(hash)}`,
      );
    }

    // For direct path-like keys return a generic serve endpoint
    const rel = path.relative(this.basePath, this.resolveLocalPath(key) || '');
    return Promise.resolve(
      `/v1/materials/local/file?path=${encodeURIComponent(rel)}`,
    );
  }

  getPresignedUploadUrl(
    key: string,
    _contentType: string,
    _contentLength: number,
  ): Promise<string> {
    // Not applicable for local storage; return a backend upload endpoint
    return Promise.resolve(
      `/v1/materials/upload?key=${encodeURIComponent(key)}`,
    );
  }

  async deleteObject(key: string) {
    if (key.startsWith('local:')) {
      this.logger.warn(
        'deleteObject called for local:<hash> — no filesystem action taken',
        { key },
      );
      return true;
    }

    const target = this.resolveLocalPath(key);
    if (!target) {
      return true;
    }
    try {
      await fs.unlink(target);
      this.logger.log('Deleted local file', { target });
    } catch (err) {
      this.logger.warn('Failed to delete local file', {
        target,
        error: (err as any)?.message,
      });
    }
    return true;
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    if (key.startsWith('local:')) {
      throw new Error(
        'Cannot download by local:<hash> key without mapping to filename',
      );
    }
    const target = this.resolveLocalPath(key);
    if (!target) {
      return Buffer.from([]);
    }
    return fs.readFile(target);
  }
}
