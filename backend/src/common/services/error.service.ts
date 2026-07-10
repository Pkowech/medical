import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from '#common/utils/error.utils';

@Injectable()
export class ErrorService {
  private readonly logger = new Logger(ErrorService.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  logError(error: unknown, context: string, sensitiveData?: any) {
    // In development, we log everything
    if (this.isDevelopment) {
      this.logger.error({
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        context,
        sensitiveData,
      });
      return;
    }

    // In production, we only log non-sensitive information
    this.logger.error({
      message: this.sanitizeErrorMessage(getErrorMessage(error)),
      context,
      timestamp: new Date().toISOString(),
    });
  }

  private sanitizeErrorMessage(message: string): string {
    // Generic messages for common errors
    if (message.includes('password')) {
      return 'Authentication error occurred';
    }
    if (message.includes('email') || message.includes('username')) {
      return 'Invalid credentials';
    }
    if (message.includes('token')) {
      return 'Session error occurred';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'Access denied';
    }

    // Default generic message
    return 'An error occurred';
  }

  getPublicErrorMessage(error: unknown): string {
    return this.sanitizeErrorMessage(getErrorMessage(error));
  }
}
