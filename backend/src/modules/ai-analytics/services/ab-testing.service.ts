// UX-003: A/B Test Framework
// Random 50/50 experiment assignment with outcome tracking and chi-squared significance testing.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export type ExperimentGroup = 'control' | 'treatment';

export interface SignificanceResult {
  isSignificant: boolean;
  pValue: number;
  controlPassRate: number;
  treatmentPassRate: number;
  totalAssignments: number;
}

@Injectable()
export class AbTestingService {
  private readonly logger = new Logger(AbTestingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign user to experiment group (50/50 random split).
   * Returns existing assignment if already assigned.
   */
  async assignToExperiment(
    userId: string,
    experimentId: string,
  ): Promise<ExperimentGroup> {
    try {
      // Check for existing assignment
      const existing = await this.prisma.experimentAssignment.findUnique({
        where: { experimentId_userId: { experimentId, userId } },
      });

      if (existing) {
        return existing.group as ExperimentGroup;
      }

      // Verify experiment is active
      const experiment = await this.prisma.interventionExperiment.findUnique({
        where: { id: experimentId },
      });

      if (!experiment || !experiment.isActive) {
        return 'control'; // Default to control if experiment inactive
      }

      // Random 50/50 assignment
      const group: ExperimentGroup =
        Math.random() < 0.5 ? 'control' : 'treatment';

      await this.prisma.experimentAssignment.create({
        data: { experimentId, userId, group },
      });

      return group;
    } catch (error) {
      this.logger.warn(
        `Failed to assign user ${userId} to experiment ${experimentId}: ${getErrorMessage(error)}`,
      );
      return 'control'; // Safe default
    }
  }

  /**
   * Get user's group assignment for an experiment.
   */
  async getAssignment(
    userId: string,
    experimentId: string,
  ): Promise<ExperimentGroup | null> {
    const assignment = await this.prisma.experimentAssignment.findUnique({
      where: { experimentId_userId: { experimentId, userId } },
    });

    return (assignment?.group as ExperimentGroup) ?? null;
  }

  /**
   * Record outcome metrics for a user in an experiment.
   * Merges with existing outcomes JSON.
   */
  async recordOutcome(
    userId: string,
    experimentId: string,
    metrics: Record<string, number | boolean>,
  ): Promise<void> {
    const assignment = await this.prisma.experimentAssignment.findUnique({
      where: { experimentId_userId: { experimentId, userId } },
    });

    if (!assignment) {
      return;
    }

    const existing = (assignment.outcomes as Record<string, unknown>) ?? {};
    const merged = {
      ...existing,
      ...metrics,
      recordedAt: new Date().toISOString(),
    };

    await this.prisma.experimentAssignment.update({
      where: { id: assignment.id },
      data: { outcomes: merged },
    });
  }

  /**
   * Calculate statistical significance using chi-squared test on pass rates.
   * Requires at least 30 assignments per group for reliable results.
   */
  async calculateSignificance(
    experimentId: string,
  ): Promise<SignificanceResult> {
    const assignments = await this.prisma.experimentAssignment.findMany({
      where: { experimentId },
    });

    const controlAssignments = assignments.filter((a) => a.group === 'control');
    const treatmentAssignments = assignments.filter(
      (a) => a.group === 'treatment',
    );

    const controlPasses = controlAssignments.filter(
      (a) => (a.outcomes as any)?.passed === true,
    ).length;
    const treatmentPasses = treatmentAssignments.filter(
      (a) => (a.outcomes as any)?.passed === true,
    ).length;

    const controlTotal = controlAssignments.length;
    const treatmentTotal = treatmentAssignments.length;

    if (controlTotal === 0 || treatmentTotal === 0) {
      return {
        isSignificant: false,
        pValue: 1,
        controlPassRate: 0,
        treatmentPassRate: 0,
        totalAssignments: assignments.length,
      };
    }

    const controlPassRate = controlPasses / controlTotal;
    const treatmentPassRate = treatmentPasses / treatmentTotal;

    // Chi-squared test
    const total = controlTotal + treatmentTotal;
    const totalPasses = controlPasses + treatmentPasses;
    const expectedControl = (controlTotal * totalPasses) / total;
    const expectedTreatment = (treatmentTotal * totalPasses) / total;

    let chiSquared = 0;
    if (expectedControl > 0) {
      chiSquared +=
        Math.pow(controlPasses - expectedControl, 2) / expectedControl;
    }
    if (expectedTreatment > 0) {
      chiSquared +=
        Math.pow(treatmentPasses - expectedTreatment, 2) / expectedTreatment;
    }

    // Approximate p-value: chi-squared with df=1, significant at p < 0.05 if chiSquared > 3.84
    const isSignificant = chiSquared > 3.84;
    const pValue = isSignificant ? 0.05 / chiSquared : 1; // Simplified approximation

    return {
      isSignificant,
      pValue: Math.round(pValue * 1000) / 1000,
      controlPassRate: Math.round(controlPassRate * 1000) / 1000,
      treatmentPassRate: Math.round(treatmentPassRate * 1000) / 1000,
      totalAssignments: assignments.length,
    };
  }

  /**
   * Create a new experiment.
   */
  async createExperiment(
    name: string,
    description: string,
    startDate: Date = new Date(),
  ): Promise<string> {
    const experiment = await this.prisma.interventionExperiment.create({
      data: { name, description, startDate },
    });
    return experiment.id;
  }
}
