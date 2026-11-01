import { Module, OnApplicationShutdown } from '@nestjs/common';
import {
  ClientGrpc,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { throwError } from 'rxjs';
import { InterceptingCall } from '@grpc/grpc-js';

const resolveProtoPath = (): string => {
  const prodProto = join(
    process.cwd(),
    'dist',
    'generated',
    'grpc',
    'analytics.proto',
  );
  const devProto = join(process.cwd(), '..', 'protos', 'analytics.proto');
  const protoPath = existsSync(prodProto)
    ? prodProto
    : existsSync(devProto)
      ? devProto
      : null;

  if (!protoPath) {
    throw new Error(
      `Proto file not found. Checked these locations:\n - ${prodProto}\n - ${devProto}\n` +
        'If you are running the built app make sure `nest build` copies protos into dist (see nest-cli.json assets).',
    );
  }

  return protoPath;
};

const createDisabledAnalyticsClient = (): ClientGrpc &
  OnApplicationShutdown => {
  const createUnavailableService = () =>
    new Proxy<
      Record<string, (...args: unknown[]) => ReturnType<typeof throwError>>
    >(
      {},
      {
        get:
          () =>
          (..._args: unknown[]) =>
            throwError(
              () =>
                new Error(
                  'Rust analytics gRPC is disabled; set ENABLE_GRPC=true',
                ),
            ),
      },
    );

  return {
    getService: <T extends object>() => createUnavailableService() as T,
    getClientByServiceName: <T = unknown>() => createUnavailableService() as T,
    onApplicationShutdown: () => undefined,
  };
};

const createAnalyticsClient = (
  configService: ConfigService,
): ClientGrpc & OnApplicationShutdown => {
  const enableGrpc = configService.get<boolean | string>('ENABLE_GRPC', true);
  if (enableGrpc !== true && enableGrpc !== 'true') {
    return createDisabledAnalyticsClient();
  }

  const configuredUrl =
    configService.get<string>('ANALYTICS_GRPC_URL') ||
    configService.get<string>('RUST_ANALYTICS_GRPC_URL');
  const grpcUrl = (configuredUrl ?? '').trim().replace(/^https?:\/\//, '');

  if (!grpcUrl) {
    throw new Error(
      'ANALYTICS_GRPC_URL or RUST_ANALYTICS_GRPC_URL must be configured when ENABLE_GRPC=true',
    );
  }

  const apiKey = configService.get<string>('RUST_ANALYTICS_API_KEY');
  if (!apiKey) {
    throw new Error('RUST_ANALYTICS_API_KEY is required when ENABLE_GRPC=true');
  }

  const apiKeyInterceptor = (options: any, nextCall: any) =>
    new InterceptingCall(nextCall(options), {
      start(metadata, listener, next) {
        metadata.set('x-api-key', apiKey);
        next(metadata, listener);
      },
    });

  const client = ClientProxyFactory.create({
    transport: Transport.GRPC,
    options: {
      package: 'analytics',
      protoPath: resolveProtoPath(),
      url: grpcUrl,
      loader: {
        keepCase: false,
        defaults: true,
        arrays: true,
        objects: true,
      },
      channelOptions: {
        interceptors: [apiKeyInterceptor],
      } as any,
    },
  });

  return Object.assign(client, {
    onApplicationShutdown: () => client.close(),
  });
};

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'ANALYTICS_PACKAGE',
      inject: [ConfigService],
      useFactory: createAnalyticsClient,
    },
  ],
  exports: ['ANALYTICS_PACKAGE'],
})
export class GrpcModule {}
