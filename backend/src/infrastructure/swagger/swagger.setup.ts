// src/swagger/swagger.setup.ts
import { INestApplication, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from '../../config/swagger.config';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '../../config/api.config';
import { getPublicApiOrigin } from '../../config/public-api-url';

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
    const serverOrigin = getPublicApiOrigin(configService, environment, port);

    const document = SwaggerModule.createDocument(
      app,
      {
        ...swaggerConfig,
        servers: serverOrigin
          ? [
              {
                url: `${serverOrigin}/${API_PREFIX}`,
                description: 'API server',
              },
            ]
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
