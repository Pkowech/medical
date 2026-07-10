// src/common/utils/file.utils.ts
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileUtils {
  static generateUniqueFilename(originalName: string): string {
    const ext = extname(originalName);
    const name = originalName.replace(ext, '');
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedName}_${uuidv4()}${ext}`;
  }

  static isImageFile(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }

  static isVideoFile(mimetype: string): boolean {
    return mimetype.startsWith('video/');
  }

  static isDocumentFile(mimetype: string): boolean {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    return documentTypes.includes(mimetype);
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
