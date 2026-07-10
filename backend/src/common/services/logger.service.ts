import { Injectable, Logger, Scope } from '@nestjs/common';

interface LogContext {
  userId?: string;
  requestId?: string;
  action?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: any;
  environment?: string;
  userId?: string;
  requestId?: string;
  action?: string;
  stack?: string;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService extends Logger {
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  error(message: any, stack?: string, context?: string) {
    const logEntry = this.createLogEntry('ERROR', message, { context });
    if (stack && this.isDevelopment) {
      logEntry.stack = stack;
    }
    super.error(JSON.stringify(logEntry));
  }

  warn(message: any, context?: string) {
    const logEntry = this.createLogEntry('WARN', message, { context });
    super.warn(JSON.stringify(logEntry));
  }

  log(message: any, context?: string) {
    const logEntry = this.createLogEntry('INFO', message, { context });
    super.log(JSON.stringify(logEntry));
  }

  debug(message: any, context?: string) {
    if (this.isDevelopment) {
      const logEntry = this.createLogEntry('DEBUG', message, { context });
      super.debug(JSON.stringify(logEntry));
    }
  }

  private createLogEntry(
    level: string,
    message: any,
    context?: LogContext,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
      environment: process.env.NODE_ENV,
    };
  }
}
