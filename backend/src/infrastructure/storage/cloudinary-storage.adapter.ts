import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { IFileStorage } from './file-storage.interface';

@Injectable()
export class CloudinaryStorageAdapter implements IFileStorage {
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folder: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME') || '';
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET') || '';
    this.folder = this.configService.get<string>('CLOUDINARY_FOLDER') || 'medtrack';

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
      secure: true,
    });
  }

  private ensureConfigured() {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error(
        'Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
  }

  private normalizeKey(key: string) {
    return key.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private getPublicId(key: string) {
    const normalized = this.normalizeKey(key);
    return normalized.replace(/\.[^/.]+$/, '');
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<{ secure_url: string; public_id: string; resource_type: string }> {
    this.ensureConfigured();

    const resourceType = contentType.startsWith('image/') ? 'image' : 'auto';
    const publicId = this.getPublicId(key);

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: this.folder,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
          ...(metadata ? { metadata } : {}),
        },
        (error: unknown, uploadResult: UploadApiResponse | undefined) => {
          if (error) {
            reject(error);
            return;
          }
          if (!uploadResult) {
            reject(new Error('Cloudinary upload returned no result.'));
            return;
          }
          resolve(uploadResult);
        },
      );

      uploadStream.end(Buffer.from(buffer));
    });

    this.logger.log(`Uploaded asset to Cloudinary: ${result.secure_url}`);
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
    };
  }

  getPresignedDownloadUrl(key: string): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    const publicId = this.getPublicId(normalizedKey);
    const publicUrl = this.buildPublicUrl(publicId);
    return Promise.resolve(publicUrl);
  }

  getPresignedUploadUrl(
    key: string,
    _contentType: string,
    _contentLength: number,
  ): Promise<string> {
    this.ensureConfigured();
    const publicId = this.getPublicId(key);
    return Promise.resolve(this.buildPublicUrl(publicId));
  }

  async deleteObject(key: string): Promise<any> {
    this.ensureConfigured();
    const publicId = this.getPublicId(key);
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    throw new Error(`Cloudinary downloadBuffer is not supported for key ${key}`);
  }

  private buildPublicUrl(publicId: string) {
    if (!this.cloudName) {
      return `https://res.cloudinary.com/${this.cloudName}/${publicId}`;
    }
    return `https://res.cloudinary.com/${this.cloudName}/${publicId}`;
  }
}
