import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '#common/dto/base-response.dto';

/**
 * Helper to attach ApiResponse for ApiResponseDto<T> where `data` contains the provided model.
 * Usage: @ApiResponseWithData(HttpStatus.OK, MyDto)
 */
export function ApiResponseWithData(status: number, model: Type<any>) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );
}
