import {
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}

export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}

// Convenience aliases for clearer intent in calling code
export const safeMessage = getErrorMessage;
export const safeStack = getErrorStack;

export function isPrismaError(
  error: unknown,
): error is { code: string; message: string; meta?: { target?: string[] } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Centralized error handler for services.
 * Logs the error and throws an appropriate NestJS HttpException.
 * @param error The error to handle.
 * @param logger The logger instance from the calling service.
 * @param context A context string for logging, e.g., the method name.
 */
export function handleServiceError(
  error: unknown,
  logger: Logger,
  context?: string,
): never {
  const errorMessage = getErrorMessage(error);
  const errorStack = getErrorStack(error);
  const logContext = context || 'Unknown Context';

  // Re-throw specific HTTP exceptions
  if (
    error instanceof NotFoundException ||
    error instanceof BadRequestException ||
    error instanceof ConflictException ||
    error instanceof ForbiddenException ||
    error instanceof InternalServerErrorException
  ) {
    throw error;
  }

  if (isPrismaError(error)) {
    logger.error(
      `Prisma Error in ${logContext}: ${error.code} - ${errorMessage}`,
      errorStack,
    );

    switch (error.code) {
      case 'P2002': {
        // Unique constraint failed
        const fields = error.meta?.target?.join(', ') || 'fields';
        throw new ConflictException(
          `A record with these ${fields} already exists.`,
        );
      }
      case 'P2025': {
        // Record to update or delete does not exist
        throw new NotFoundException(
          `The requested resource was not found to perform the operation.`,
        );
      }
      case 'P2003':
        // Foreign key constraint failed
        throw new BadRequestException(
          'Operation failed due to an invalid reference to another record.',
        );
      default:
        // For other Prisma errors, throw a generic server error
        throw new InternalServerErrorException('A database error occurred.');
    }
  }

  // For any other unknown errors
  logger.error(`Unhandled Error in ${logContext}: ${errorMessage}`, errorStack);
  throw new InternalServerErrorException('An unexpected error occurred.');
}
