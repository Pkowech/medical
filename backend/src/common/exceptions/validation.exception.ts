// src/common/exceptions/validation.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(
    message: string = 'Validation failed',
    errors?: Record<string, string[]>,
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Validation Error',
        details: errors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
