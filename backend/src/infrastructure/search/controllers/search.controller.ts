// src/modules/search/controllers/search.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { getErrorMessage } from '#common/utils/error.utils';
import { SearchCacheService } from '../services/search-cache.service';
import { SearchQueryDto, SearchResponseDto } from '#common/dto/search.dto';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly searchCacheService: SearchCacheService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search for courses, materials, or users' })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    type: () => SearchResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(@Query() queryDto: SearchQueryDto): Promise<SearchResponseDto> {
    try {
      // Validate basic query structure
      if (!queryDto.query) {
        throw new BadRequestException('Search query is required');
      }

      const startTime = Date.now();

      // Check cache first
      const cachedResults =
        await this.searchCacheService.getCachedResults(queryDto);

      if (cachedResults) {
        this.logger.log(
          `Cache hit for query: "${queryDto.query}" (${Date.now() - startTime}ms)`,
        );
        return cachedResults;
      }

      // Perform search
      const results = await this.searchService.search(queryDto);

      // Cache results asynchronously (don't wait for it)
      this.searchCacheService.cacheResults(queryDto, results).catch((error) => {
        this.logger.warn(
          `Failed to cache search results: ${getErrorMessage(error)}`,
        );
      });

      const elapsedTime = Date.now() - startTime;
      this.logger.log(
        `Search completed for query: "${queryDto.query}" - Found ${results.total} results (${elapsedTime}ms)`,
      );

      return results;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Search operation failed:`, {
        query: queryDto.query,
        type: queryDto.type,
        error: getErrorMessage(error),
      });

      throw new BadRequestException(
        `Search failed: ${getErrorMessage(error) || 'Unknown error'}`,
      );
    }
  }
}
