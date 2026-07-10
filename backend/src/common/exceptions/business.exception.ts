import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class BusinessException extends BaseException {
  readonly statusCode = HttpStatus.BAD_REQUEST;
  readonly message: string;

  constructor(message: string = 'Business rule violation') {
    super(message);
    this.message = message;
  }
}
