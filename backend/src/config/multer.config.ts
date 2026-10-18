// src/config/multer.config.ts
import { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const multerConfig: MulterModuleOptions = {
  storage: diskStorage({
    destination: './uploads',
    filename: (_req, file, cb) => {
      const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
    ]);
    const allowedExtensions = new Set([
      'pdf',
      'doc',
      'docx',
      'ppt',
      'pptx',
      'mp4',
      'mpg',
      'mpeg',
      'mov',
      'avi',
      'webm',
    ]);
    const extension = extname(file.originalname).replace('.', '').toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase();

    if (allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension)) {
      return cb(null, true);
    }

    cb(new Error('Only specific file types are allowed'), false);
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
};
