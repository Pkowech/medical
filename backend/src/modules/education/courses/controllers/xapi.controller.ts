import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { XapiService } from '../services/xapi.service';
import { RedisService } from '#infrastructure/redis/redis.service';
import { CreateXapiStatementDto } from '../dto/create-xapi-statement.dto';

@ApiTags('xAPI')
@Controller('progress/statements')
export class XapiController {
  constructor(
    private readonly xapiService: XapiService,
    private readonly redisService: RedisService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ingest an xAPI statement (Tin Can) to the system' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async ingest(
    @Body() statement: CreateXapiStatementDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const userId = req.user?.id;

    // If an idempotency key is provided, attempt to return cached response
    if (idempotencyKey) {
      const key = `idempotency:${idempotencyKey}`;
      const cached = await this.redisService.get(key);
      if (cached) {
        return cached;
      }
    }

    const result = await this.xapiService.saveStatement(
      statement as any,
      userId,
    );

    if (idempotencyKey && result) {
      const key = `idempotency:${idempotencyKey}`;
      // Cache response for 24 hours
      await this.redisService.set(key, result, 60 * 60 * 24);
    }

    return result;
  }

  // Health endpoint has been moved to /internal/health/xapi and is handled by XapiHealthController
}
