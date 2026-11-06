// src/swagger/swagger.setup.ts
import { INestApplication, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from '../../config/swagger.config';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(app: INestApplication): void {
  const logger = new Logger('SwaggerSetup');
  const configService = app.get(ConfigService);

  try {
    if (!configService.get<boolean>('SWAGGER_ENABLED', true)) {
      logger.log('Swagger documentation is disabled');
      return;
    }

    const environment = configService.get<string>('NODE_ENV', 'development');
    const port = configService.get<number>('PORT', 3002);
    const serverUrl =
      configService.get<string>('PUBLIC_API_URL') ??
      process.env.RENDER_EXTERNAL_URL ??
      (environment === 'development' ? `http://localhost:${port}` : undefined);
    let serverOrigin: string | undefined;

    if (serverUrl) {
      try {
        serverOrigin = new URL(serverUrl).origin;
      } catch {
        logger.warn(
          'Public API URL is invalid; Swagger will omit its server URL.',
        );
      }
    }

    const document = SwaggerModule.createDocument(
      app,
      {
        ...swaggerConfig,
        servers: serverOrigin
          ? [{ url: `${serverOrigin}/v1`, description: 'API server' }]
          : [],
      },
      {
        deepScanRoutes: false,
        operationIdFactory: (controllerKey: string, methodKey: string) =>
          `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
        ignoreGlobalPrefix: true,
      },
    );
    SwaggerModule.setup('api/docs', app, document, {
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui { max-width: 100%; }
      `,
      swaggerOptions: {
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
      },
    });

    logger.log('✅ Swagger documentation enabled at /api/docs');
  } catch (error) {
    logger.warn(
      `Swagger documentation generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
