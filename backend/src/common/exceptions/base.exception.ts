// src/common/exceptions/base.exception.ts
export abstract class BaseException extends Error {
  abstract readonly statusCode: number;
  abstract readonly message: string;
  readonly timestamp: string;

  constructor(message?: string) {
    super(message);
    this.timestamp = new Date().toISOString();
  }
}
