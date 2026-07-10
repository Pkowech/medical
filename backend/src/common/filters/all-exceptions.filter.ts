import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Detailed logging for non-HTTP exceptions (potential 500s)
    if (status >= 500) {
      const error = exception as Error;
      console.error(
        `[AllExceptionsFilter] ERROR ${status} on ${request.method} ${request.url}`,
      );
      console.error(`[AllExceptionsFilter] Name: ${error?.name || 'Unknown'}`);
      console.error(
        `[AllExceptionsFilter] Message: ${error?.message || String(exception)}`,
      );
      if (error?.stack) {
        console.error(`[AllExceptionsFilter] Stack: ${error.stack}`);
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
