import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from '#infrastructure/metrics/metrics.service';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

@Injectable()
export class AnalyticsAlertService {
  private readonly logger = new Logger(AnalyticsAlertService.name);
  private lastCheckedRequests = 0;
  private lastCheckedDegradations = 0;

  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkDegradationRate() {
    this.logger.log('Running hourly analytics degradation check...');

    const summary = await this.metrics.getMetricsSummary();
    const currentTotal = summary.analyticsRequestsTotal;
    const currentDegraded = summary.analyticsDegradationTotal;

    const deltaRequests = currentTotal - this.lastCheckedRequests;
    const deltaDegraded = currentDegraded - this.lastCheckedDegradations;

    // Update markers for next run
    this.lastCheckedRequests = currentTotal;
    this.lastCheckedDegradations = currentDegraded;

    if (deltaRequests <= 0) {
      this.logger.log('No analytics requests in the last hour.');
      return;
    }

    const rate = (deltaDegraded / deltaRequests) * 100;

    if (rate > 5) {
      const alertMessage = `CRITICAL: Analytics degradation rate is ${rate.toFixed(2)}% (Threshold: 5%) in the last hour. Requests: ${deltaRequests}, Degradations: ${deltaDegraded}`;
      this.logger.error(alertMessage);

      // Note: In production, this would trigger external alerts (PagerDuty, Email, etc.)
    } else {
      this.logger.log(
        `Analytics health check passed. Degradation rate: ${rate.toFixed(2)}%`,
      );
    }

    // Update gauge for external monitoring (Prometheus)
    this.metrics.updateAnalyticsDegradationRate(deltaRequests, deltaDegraded);
  }
}
