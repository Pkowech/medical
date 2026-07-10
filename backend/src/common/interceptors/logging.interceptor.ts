// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const userId = user?.id || 'anonymous';

    this.logger.log(`[${method}] ${url} - User: ${userId}`);

    if (Object.keys(body).length > 0) {
      this.logger.debug('Request body:', JSON.stringify(body));
    }

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (_data) => {
          this.logger.log(
            `[${method}] ${url} - ${Date.now() - now}ms - Success`,
          );
        },
        error: (error) => {
          this.logger.error(
            `[${method}] ${url} - ${Date.now() - now}ms - Error: ${getErrorMessage(error)}`,
            getErrorStack(error),
          );
        },
      }),
    );
  }
}
