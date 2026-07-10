import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file!: Buffer;

  @ApiProperty({ example: 'course-material' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'lecture.pdf' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ example: 1024 })
  @IsNumber()
  size!: number;

  @ApiProperty({ example: 'https://s3.amazonaws.com/lecture.pdf' })
  @IsString()
  url!: string;
}

export class FileResponseDto {
  @ApiProperty({ example: '123' })
  id!: string;

  @ApiProperty({ example: 'lecture.pdf' })
  name!: string;

  @ApiProperty({ example: 'https://s3.amazonaws.com/lecture.pdf' })
  url!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 1024 })
  size!: number;
}

export interface FileUploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}
