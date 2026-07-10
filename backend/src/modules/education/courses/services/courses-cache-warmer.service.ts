import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CoursesService } from './courses.service';

@Injectable()
export class CoursesCacheWarmerService implements OnModuleInit {
  private readonly logger = new Logger(CoursesCacheWarmerService.name);

  constructor(private readonly coursesService: CoursesService) {}

  async onModuleInit() {
    this.logger.log('Initializing Courses Cache Warmer...');
    await this.warmCache();
  }

  @Interval(1800000) // Every 30 minutes
  async handleCacheWarming() {
    this.logger.log('Running scheduled cache warming...');
    await this.warmCache();
  }

  private async warmCache() {
    try {
      this.logger.debug('Warming featured courses cache...');
      // Warmfeatured courses (limit 3 as used in MarketingPage)
      await this.coursesService.getFeaturedCourses(3);

      this.logger.debug('Warming total courses stats cache...');
      // Warm total courses count (used in MarketingPage hero section)
      // The MarketingPage calls getCourses({ limit: 1 })
      await this.coursesService.findAll(
        { limit: 1 } as any,
        {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        } as any,
      );

      this.logger.log('Courses cache warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm courses cache', error);
    }
  }
}
