import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { existsSync } from 'fs';
import { of } from 'rxjs';

// Resolve proto path in a runtime-safe way:
// 1) Prefer the proto copied into the compiled `dist` (production/self-contained)
// 2) Fallback to the repo `protos` directory for development runs
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

// Only register the Nest ClientsModule for gRPC when explicitly enabled.
// This avoids runtime proto-loading errors in development environments
// where the external gRPC service or protos are not available.
const grpcImports = [] as any[];
if (process.env.ENABLE_GRPC === 'true') {
  grpcImports.push(
    ClientsModule.register([
      {
        name: 'ANALYTICS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'analytics',
          protoPath,
          url: 'localhost:50051',
          loader: {
            keepCase: false,
          },
        },
      },
    ]),
  );
}

// Provide a lightweight stub for the ClientGrpc package token when GRPC is
// disabled so modules that inject the token do not fail during DI resolution.
// The stub returns a proxy whose methods return an rxjs Observable (of({})),
// which keeps downstream call sites that expect Observables working without
// requiring the external analytics gRPC service to be available.
const stubAnalyticsPackageProvider = {
  provide: 'ANALYTICS_PACKAGE',
  useValue: {
    getService: () => {
      return new Proxy(
        {},
        {
          get: () => {
            return (..._args: any[]) => of({});
          },
        },
      );
    },
  },
};

const grpcProviders: any[] = [];
if (process.env.ENABLE_GRPC !== 'true') {
  grpcProviders.push(stubAnalyticsPackageProvider);
}

@Module({
  imports: grpcImports,
  providers: grpcProviders,
  exports:
    process.env.ENABLE_GRPC === 'true'
      ? [ClientsModule, 'ANALYTICS_PACKAGE']
      : ['ANALYTICS_PACKAGE'],
})
export class GrpcModule {}
