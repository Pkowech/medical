// src/common/decorators/api-operation.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiOperationWithResponse(
  summary: string,
  description: string,
  responseType?: Type<any>,
) {
  const decorators = [
    ApiOperation({ summary, description }),
    ApiResponse({
      status: 200,
      description: 'Success',
      ...(responseType && { type: responseType }),
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Validation failed',
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing token',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
    }),
  ];

  return applyDecorators(...decorators);
}
