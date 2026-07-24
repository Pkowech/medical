// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '#common/dto/base-response.dto';

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Recursive helper to handle BigInt serialization
        const serializeBigInt = (obj: any, seen = new WeakMap()): any => {
          if (obj === null || obj === undefined) {
            return obj;
          }
          if (typeof obj === 'bigint') {
            return obj.toString();
          }
          if (obj instanceof Date) {
            return obj;
          }
          if (typeof obj !== 'object') {
            return obj;
          }

          // Basic check for common types we can skip
          if (obj instanceof Buffer || obj instanceof RegExp) {
            return obj;
          }

          // Handle circular references
          if (seen.has(obj)) {
            return seen.get(obj);
          }

          let newObj: any;
          if (Array.isArray(obj)) {
            newObj = [];
            seen.set(obj, newObj);
            obj.forEach((item) => newObj.push(serializeBigInt(item, seen)));
          } else {
            // Handle ApiResponseDto specifically to preserve its instance type
            const isApiResponseDto = obj instanceof ApiResponseDto;
            newObj = isApiResponseDto
              ? Object.create(ApiResponseDto.prototype)
              : obj.constructor === Object
                ? {}
                : Object.create(Object.getPrototypeOf(obj));

            seen.set(obj, newObj);

            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                try {
                  newObj[key] = serializeBigInt(obj[key], seen);
                } catch {
                  // Fallback for tricky properties (like getters that might throw)
                  newObj[key] = obj[key];
                }
              }
            }
          }
          return newObj;
        };

        try {
          const serializedData = serializeBigInt(data);

          // If data is already an ApiResponseDto, convert to a plain object
          if (serializedData instanceof ApiResponseDto) {
            response.status(serializedData.statusCode || HttpStatus.OK);
            return {
              success: serializedData.success,
              message: serializedData.message,
              // If ApiResponseDto explicitly sets data to null, normalize to an empty object
              data:
                serializedData.data === undefined ||
                serializedData.data === null
                  ? {}
                  : serializedData.data,
              statusCode: serializedData.statusCode,
              timestamp: serializedData.timestamp,
              errors: serializedData.errors,
            };
          }

          // If data has success, data, timestamp properties, it's already formatted
          if (
            serializedData &&
            typeof serializedData === 'object' &&
            'success' in serializedData &&
            'timestamp' in serializedData
          ) {
            // Normalize null/undefined data into an empty object for consistency (e.g., logout)
            if (
              serializedData.data === undefined ||
              serializedData.data === null
            ) {
              serializedData.data = {};
            }
            return serializedData;
          }

          // Get status code from response
          const statusCode = response.statusCode || HttpStatus.OK;

          // For null/undefined responses (like logout), return success with empty data
          if (serializedData === null || serializedData === undefined) {
            return {
              success: true,
              data: {},
              statusCode,
              timestamp: new Date().toISOString(),
            };
          }

          // Wrap other responses in standard format
          return {
            success: true,
            data: serializedData,
            statusCode,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error('[TransformInterceptor] Serialization failed:', error);
          // Fallback to raw data if transformation fails catastrophically
          return {
            success: true,
            data,
            statusCode: response.statusCode || HttpStatus.OK,
            timestamp: new Date().toISOString(),
          };
        }
      }),
    );
  }
}
