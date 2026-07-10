import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ description: 'Search keyword', example: 'cardiology' })
  @IsString()
  query!: string;

  @ApiProperty({ description: 'Page number', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 10 })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Entity type to search',
    example: 'course',
    enum: ['course', 'material', 'unit', 'topic', 'user', 'quiz', 'case'],
  })
  @IsString()
  @IsOptional()
  type?: 'course' | 'material' | 'unit' | 'topic' | 'user' | 'quiz' | 'case';

  @ApiPropertyOptional({
    description: 'Context type (e.g. current page)',
    example: 'course',
  })
  @IsString()
  @IsOptional()
  contextType?: string;

  @ApiPropertyOptional({
    description: 'ID related to the course context (e.g. courseId)',
    example: '123',
  })
  @IsString()
  @IsOptional()
  courseContextId?: string;
}

export class SearchResult {
  @ApiProperty({ description: 'Entity ID', example: '123' })
  id!: string;

  @ApiProperty({ description: 'Entity type', example: 'course' })
  type!: string;

  @ApiProperty({ description: 'File type', example: 'pdf' })
  fileType!: string;

  @ApiProperty({ description: 'Title or name', example: 'Cardiology Basics' })
  title!: string;

  @ApiPropertyOptional({
    description: 'Description or summary',
    example: 'Introductory course on cardiology',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Text snippet with matches highlighted',
    example: '...introduction to <mark>cardiology</mark> basics...',
  })
  snippet?: string;

  @ApiProperty({ description: 'Relevance score', example: 0.95 })
  relevance!: number;

  @ApiPropertyOptional({ description: 'Term that matched via synonym', example: 'Heart Attack' })
  matchedSynonym?: string;
}

export class SearchResponseDto {
  @ApiProperty({
    description: 'Search results',
    type: () => SearchResult,
    isArray: true,
  })
  results!: SearchResult[];

  @ApiProperty({ description: 'Total number of results', example: 100 })
  total!: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit!: number;

  @ApiPropertyOptional({ description: 'The query after expansion', example: '(Heart Attack | Myocardial Infarction)' })
  expandedQuery?: string;

  @ApiPropertyOptional({ description: 'List of medical terms that matched synonyms', example: ['Myocardial Infarction'] })
  synonymsMatched?: string[];

  @ApiPropertyOptional({
    description: 'Result counts by entity type',
    example: { course: 5, material: 10 },
  })
  facets?: Record<string, number>;
}
