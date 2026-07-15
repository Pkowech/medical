// c:\Users\user\medical\backend\src\infrastructure\storage\storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    this.s3Client = new S3Client({
      region: 'auto',
      ...(endpoint && { endpoint }),
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }),
    });
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    contentLength: number,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async getPresignedDownloadUrl(
    key: string,
    options?: {
      filename?: string;
      contentType?: string;
      inline?: boolean;
    },
  ) {
    const filename = options?.filename || key.split('/').pop()?.split('\\').pop() || 'download';
    const contentType = options?.contentType || 'application/octet-stream';
    const disposition = options?.inline === false ? 'attachment' : 'inline';

    // Sanitize filename to avoid header injection and problematic characters
    const safeFilename = String(filename).replace(/["\r\n]/g, '_').slice(0, 200);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: `${disposition}; filename="${safeFilename}"`,
      ResponseContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  /**
   * Upload a buffer (or stream) directly to the configured bucket.
   * Returns once the object has been stored.
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string,
    metadata?: Record<string, string>,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata
        ? Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    });

    return this.s3Client.send(command);
  }

  /** Delete object from storage */
  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return this.s3Client.send(command);
  }

  /**
   * Download an object into a Buffer
   */
  async downloadBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    const body = response.Body as Readable | undefined;
    if (!body) {
      return Buffer.from([]);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      body.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      body.on('end', () => resolve(Buffer.concat(chunks)));
      body.on('error', (err) => reject(err));
    });
  }
}
