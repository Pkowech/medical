// c:\Users\user\medical\backend\src\infrastructure\storage\storage.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3StorageAdapter } from './s3-storage.adapter';
import { LocalStorageService } from './local-storage.service';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { GoogleDriveService } from './google-drive.service';
import {
  MATERIAL_FILE_STORAGE,
  PROFILE_IMAGE_STORAGE,
} from './file-storage.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    S3StorageAdapter,
    LocalStorageService,
    CloudinaryStorageAdapter,
    GoogleDriveService,
    {
      provide: MATERIAL_FILE_STORAGE,
      useFactory: (
        config: ConfigService,
        s3: S3StorageAdapter,
        local: LocalStorageService,
      ) => {
        return config.get<string>('MATERIAL_FILE_STORAGE_PROVIDER') === 'local'
          ? local
          : s3;
      },
      inject: [ConfigService, S3StorageAdapter, LocalStorageService],
    },
    {
      provide: PROFILE_IMAGE_STORAGE,
      useExisting: CloudinaryStorageAdapter,
    },
  ],
  exports: [
    MATERIAL_FILE_STORAGE,
    PROFILE_IMAGE_STORAGE,
    StorageService,
    GoogleDriveService,
  ],
})
export class StorageModule {}
