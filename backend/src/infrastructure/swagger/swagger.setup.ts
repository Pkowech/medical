// src/swagger/swagger.setup.ts
import { INestApplication, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from '../../config/swagger.config';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

export function setupSwagger(app: INestApplication) {
  const config = swaggerConfig;
  const logger = new Logger('SwaggerSetup');

  try {
    // Use runtime configuration for server URLs so the root `.env` controls
    // the Swagger server entry instead of hard-coded localhost values.
    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3002);
    const hostname = configService.get<string>('HOSTNAME', '0.0.0.0');
    const displayHost =
      hostname === '0.0.0.0'
        ? configService.get('NODE_ENV') === 'development'
          ? 'localhost'
          : hostname
        : hostname;

    // Replace servers in swaggerConfig dynamically
    if (config.servers && Array.isArray(config.servers)) {
      config.servers = [
        {
          url: `http://${displayHost}:${port}`,
          description: 'Development Server (from .env)',
        },
        ...(config.servers.filter((s) => s.url && !s.url.includes('localhost')) ||
          []),
      ];
    }

    // Create Swagger document with options that minimize circular reference issues
    const swaggerOptions = {
      ...config,
      deepScanRoutes: false, // Disable deep scanning to avoid circular dependency detection
      operationIdFactory: (controllerKey: string, methodKey: string) =>
        `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
      ignoreGlobalPrefix: true,
    };

    const document = SwaggerModule.createDocument(app, swaggerOptions);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerUrl: '/api/docs',
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
      `⚠️  Swagger documentation generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    logger.warn(
      'API is fully functional, but Swagger docs are unavailable. Use Postman or OpenAPI clients for testing.'
    );
    
    // Register a fallback endpoint that explains the situation
    app.use('/api/docs', (req: Request, res: Response) => {
      res.json({
        message: 'Swagger documentation is temporarily unavailable',
        reason:
          'Circular DTO references in schema generation',
        alternatives: [
          'Use Postman collections for API testing',
          'Refer to API documentation files',
          'Use REST client extensions like REST Client or Thunder Client',
        ],
        api_ready: true,
        status: 'API is fully operational',
      });
    });
  }
}
