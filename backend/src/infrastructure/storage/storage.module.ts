// c:\Users\user\medical\backend\src\infrastructure\storage\storage.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { S3StorageAdapter } from './s3-storage.adapter';
import { LocalStorageService } from './local-storage.service';
import { FILE_STORAGE } from './file-storage.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    S3StorageAdapter,
    LocalStorageService,
    {
      provide: FILE_STORAGE,
      useFactory: (
        config: ConfigService,
        s3: S3StorageAdapter,
        local: LocalStorageService,
      ) => {
        const provider = config.get<string>('FILE_STORAGE_PROVIDER');
        return provider === 'local' ? local : s3;
      },
      inject: [ConfigService, S3StorageAdapter, LocalStorageService],
    },
  ],
  exports: [FILE_STORAGE, StorageService],
})
export class StorageModule {}
