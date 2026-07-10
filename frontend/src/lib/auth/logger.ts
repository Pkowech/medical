type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private prefix = '[MedTrack]';

  private log(level: LogLevel, ...args: unknown[]) {
    if (process.env.NODE_ENV === 'production') {
      // In production, only log errors
      if (level === 'error') {
        console.error(this.prefix, ...args);
      }
      return;
    }

    switch (level) {
      case 'info':
        console.warn(this.prefix, ...args);
        break;
      case 'warn':
        console.warn(this.prefix, ...args);
        break;
      case 'error':
        console.error(this.prefix, ...args);
        break;
    }
  }

  info(...args: unknown[]) {
    this.log('info', ...args);
  }

  warn(...args: unknown[]) {
    this.log('warn', ...args);
  }

  error(...args: unknown[]) {
    this.log('error', ...args);
  }
}

export const logger = new Logger();
