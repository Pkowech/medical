// src/modules/users/users.module.ts
import { Global, Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { RedisModule } from '#infrastructure/redis/redis.module';
import { GrpcModule } from '#infrastructure/grpc/grpc.module';
import { SharedModule } from '#modules/shared.module';
import { HttpModule } from '@nestjs/axios';
import { UserFeaturesService } from './services/user-features.service';
import { UserFeaturesController } from './controllers/user-features.controller';
import { StorageModule } from '#infrastructure/storage/storage.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HttpModule,
    SharedModule,
    GrpcModule,
    StorageModule,
  ],
  controllers: [UsersController, UserFeaturesController],
  providers: [UsersService, UserFeaturesService],
  exports: [UsersService, UserFeaturesService],
})
export class UsersModule {}
