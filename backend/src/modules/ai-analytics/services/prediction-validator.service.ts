// ANAL-002: Prediction Validation Pipeline
// Monthly cron job that compares 30–90 day old predictions against actual outcomes,
// calculates precision/recall/calibration, and alerts admin if accuracy < 70%.

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export interface ValidationReport {
  periodStart: Date;
  periodEnd: Date;
  totalValidated: number;
  precision: number;
  recall: number;
  calibrationError: number;
  isAccurate: boolean;
}

@Injectable()
export class PredictionValidatorService {
  private readonly logger = new Logger(PredictionValidatorService.name);
  private readonly ACCURACY_THRESHOLD = 0.7;
  private readonly PASSING_SCORE_THRESHOLD = 70;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Monthly validation: compare 30–90 day old predictions vs actual quiz outcomes.
   * Runs on the 1st of each month at 3 AM.
   */
  @Cron('0 3 1 * *')
  async runMonthlyValidation(): Promise<ValidationReport | null> {
    this.logger.log('Running monthly prediction validation...');
    try {
      return await this.runValidation();
    } catch (error) {
      this.logger.error(
        `Prediction validation failed: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Core validation logic — can be triggered manually for testing.
   */
  async runValidation(): Promise<ValidationReport> {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch pending (not yet calibrated) predictions from the 30–90 day window
    const predictions = await this.prisma.predictionValidation.findMany({
      where: {
        isCalibrated: false,
        predictionDate: {
          gte: ninetyDaysAgo,
          lte: thirtyDaysAgo,
        },
        actualScore: { not: null },
      },
    });

    if (predictions.length === 0) {
      this.logger.warn(
        'No predictions available for validation in the 30–90 day window.',
      );
      return {
        periodStart: ninetyDaysAgo,
        periodEnd: thirtyDaysAgo,
        totalValidated: 0,
        precision: 0,
        recall: 0,
        calibrationError: 0,
        isAccurate: true,
      };
    }

    // Calculate metrics
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let totalCalibrationError = 0;

    for (const pred of predictions) {
      const predictedPass =
        pred.predictedScore >= this.PASSING_SCORE_THRESHOLD / 100;
      const actualPass =
        (pred.actualScore ?? 0) >= this.PASSING_SCORE_THRESHOLD / 100;

      if (predictedPass && actualPass) {
        truePositives++;
      } else if (predictedPass && !actualPass) {
        falsePositives++;
      } else if (!predictedPass && actualPass) {
        falseNegatives++;
      }

      totalCalibrationError += Math.abs(
        pred.predictedScore - (pred.actualScore ?? 0),
      );
    }

    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;

    const recall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 0;

    const calibrationError = totalCalibrationError / predictions.length;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const isAccurate = f1 >= this.ACCURACY_THRESHOLD;

    // Mark predictions as calibrated
    await this.prisma.predictionValidation.updateMany({
      where: {
        id: { in: predictions.map((p) => p.id) },
      },
      data: {
        precision,
        recall,
        isCalibrated: true,
      },
    });

    const report: ValidationReport = {
      periodStart: ninetyDaysAgo,
      periodEnd: thirtyDaysAgo,
      totalValidated: predictions.length,
      precision,
      recall,
      calibrationError,
      isAccurate,
    };

    if (!isAccurate) {
      await this.alertAdmin(report);
    }

    this.logger.log(
      `Validation complete: precision=${precision.toFixed(2)}, recall=${recall.toFixed(2)}, f1=${f1.toFixed(2)}, accurate=${isAccurate}`,
    );

    return report;
  }

  /**
   * Store a new prediction for future validation.
   * Called when predictions are made — actual score populated later after quiz completion.
   */
  async recordPrediction(
    userId: string,
    topicId: string | undefined,
    predictedScore: number,
  ): Promise<void> {
    await this.prisma.predictionValidation.create({
      data: {
        userId,
        topicId,
        predictionDate: new Date(),
        predictedScore,
      },
    });
  }

  /**
   * Update actual outcome when quiz is completed.
   */
  async recordActualOutcome(
    userId: string,
    topicId: string,
    actualScore: number,
  ): Promise<void> {
    // Find the most recent uncalibrated prediction for this user/topic
    const prediction = await this.prisma.predictionValidation.findFirst({
      where: {
        userId,
        topicId,
        isCalibrated: false,
        actualScore: null,
      },
      orderBy: { predictionDate: 'desc' },
    });

    if (!prediction) {
      return;
    }

    await this.prisma.predictionValidation.update({
      where: { id: prediction.id },
      data: { actualScore },
    });
  }

  private async alertAdmin(report: ValidationReport): Promise<void> {
    this.logger.warn(
      `PREDICTION ACCURACY ALERT: F1 score below ${this.ACCURACY_THRESHOLD}. ` +
        `Precision=${report.precision.toFixed(2)}, Recall=${report.recall.toFixed(2)}, ` +
        `Validated=${report.totalValidated} predictions.`,
    );

    // Create a system notification for admin users
    try {
      const admins = await this.prisma.userRole.findMany({
        where: {
          role: { name: { in: ['admin' as any, 'super_admin' as any] } },
        },
        select: { userId: true },
        take: 5,
      });

      for (const admin of admins) {
        await (this.prisma as any).notification.create({
          data: {
            userId: admin.userId,
            message:
              `⚠️ Prediction accuracy has dropped below ${this.ACCURACY_THRESHOLD * 100}%. ` +
              `F1 score: ${((2 * report.precision * report.recall) / (report.precision + report.recall)).toFixed(2)}. ` +
              `Please review the prediction model.`,
            type: 'system_alert',
            severity: 'critical',
            metadata: { report },
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send admin alert: ${getErrorMessage(error)}`,
      );
    }
  }
}
