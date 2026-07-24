import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../../common/utils/error.utils';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AiAnalyticsService } from '#modules/ai-analytics/services/ai-analytics.service';
import {
  ClinicalCase,
  CaseAttempt,
  CaseComplexity,
  CaseSpecialty,
  CaseAttemptStatus,
  CaseStatus,
} from '@prisma/client';
import {
  CreateClinicalCaseDto,
  UpdateCaseProgressDto,
  SubmitDiagnosisDto,
} from '../../../../common/dto/clinical-case.dto';

import { GlobalSearchSyncService } from '../../../../infrastructure/search/services/global-search-sync.service';

@Injectable()
export class ClinicalCasesService {
  private readonly logger = new Logger(ClinicalCasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalyticsService: AiAnalyticsService,
    private readonly searchSync: GlobalSearchSyncService,
  ) {}

  async create(
    createClinicalCaseDto: CreateClinicalCaseDto,
    creatorId: string,
  ): Promise<ClinicalCase> {
    try {
      // Validate course and unit if provided
      if (createClinicalCaseDto.courseId) {
        const course = await this.prisma.course.findUnique({
          where: { id: createClinicalCaseDto.courseId },
        });
        if (!course) {
          this.logger.warn('Course not found', {
            courseId: createClinicalCaseDto.courseId,
          });
          throw new NotFoundException('Course not found');
        }
      }

      if (createClinicalCaseDto.unitId) {
        const unit = await this.prisma.unit.findUnique({
          where: { id: createClinicalCaseDto.unitId },
        });
        if (!unit) {
          this.logger.warn('Unit not found', {
            unitId: createClinicalCaseDto.unitId,
          });
          throw new NotFoundException('Unit not found');
        }
      }

      const clinicalCase: any = (await this.prisma.clinicalCase.create({
        data: {
          ...createClinicalCaseDto,
          createdById: creatorId,
          status: CaseStatus.draft,
        } as any,
        include: { course: true, unit: true, createdBy: true } as any,
      } as any));

      this.logger.log('Clinical case created', {
        caseId: clinicalCase.id,
        creatorId,
      });

      // Sync to global search index
      await this.searchSync.syncEntity('clinical_case', clinicalCase.id);

      return clinicalCase;
    } catch (error) {
      this.logger.error('Error creating clinical case', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getAttempt(attemptId: string, userId: string): Promise<CaseAttempt> {
    try {
      const attempt = await this.prisma.caseAttempt.findUnique({
        where: { id: attemptId },
      });
      if (!attempt || attempt.userId !== userId) {
        this.logger.warn('Attempt not found or access denied', {
          attemptId,
          userId,
        });
        throw new NotFoundException('Attempt not found');
      }
      this.logger.log('Clinical case attempt fetched', { attemptId, userId });
      return attempt;
    } catch (error) {
      this.logger.error('Error fetching case attempt', {
        attemptId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async findAll(
    filters: {
      course_id?: string;
      unit_id?: string;
      specialty?: CaseSpecialty;
      complexity?: CaseComplexity;
      status?: CaseStatus;
      search?: string;
    } = {},
  ): Promise<ClinicalCase[]> {
    try {
      const where: any = {};

      if (filters.course_id) {
        where.courseId = filters.course_id;
      }

      if (filters.unit_id) {
        where.unitId = filters.unit_id;
      }

      if (filters.specialty) {
        where.specialty = filters.specialty;
      }

      if (filters.complexity) {
        where.complexity = filters.complexity;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { tags: { has: filters.search } },
        ];
      }

      const cases: any[] = (await this.prisma.clinicalCase.findMany({
        where,
        include: {
          course: true,
          unit: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      } as any)) as any[];

      this.logger.log('Clinical cases fetched', {
        filterCount: Object.keys(filters).length,
      });
      return cases;
    } catch (error) {
      this.logger.error('Error fetching clinical cases', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async findOne(
    id: string,
    userId?: string,
  ): Promise<
    ClinicalCase & {
      user_attempts?: CaseAttempt[];
      current_attempt?: CaseAttempt;
    }
  > {
    try {
      const clinicalCase: any = (await this.prisma.clinicalCase.findUnique({
        where: { id } as any,
        include: {
          course: true,
          unit: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          attempts: userId ? { where: { userId } } : false,
        } as any,
      } as any));

      if (!clinicalCase) {
        this.logger.warn('Clinical case not found', { caseId: id });
        throw new NotFoundException('Clinical case not found');
      }

      const result: any = clinicalCase;
      if (userId && clinicalCase.attempts) {
        result.user_attempts = clinicalCase.attempts;
        result.current_attempt = clinicalCase.attempts.find(
          (attempt: CaseAttempt) => attempt.status === 'inProgress',
        );
      }

      this.logger.log('Clinical case fetched', { caseId: id, userId });
      return result;
    } catch (error) {
      this.logger.error('Error fetching clinical case', {
        caseId: id,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async startAttempt(caseId: string, userId: string): Promise<CaseAttempt> {
    try {
      const clinicalCase: any = (await this.prisma.clinicalCase.findUnique({
        where: { id: caseId, status: CaseStatus.published } as any,
      } as any));

      if (!clinicalCase) {
        this.logger.warn('Clinical case not found or not published', {
          caseId,
          userId,
        });
        throw new NotFoundException('Clinical case not found or not available');
      }

      // Check for active attempt
      const activeAttempt: any = (await this.prisma.caseAttempt.findFirst({
        where: {
          clinicalCaseId: caseId,
          userId,
          status: CaseAttemptStatus.inProgress,
        } as any,
      } as any));

      if (activeAttempt) {
        this.logger.log('Returning existing active attempt', {
          caseId,
          userId,
          attemptId: activeAttempt.id,
        });
        return activeAttempt;
      }

      // Create new attempt
      const attempt: any = (await this.prisma.caseAttempt.create({
        data: {
          clinicalCaseId: caseId,
          userId,
          status: CaseAttemptStatus.inProgress,
          started_at: new Date(),
          max_score: this.calculateMaxScore(clinicalCase),
          progress: {
            current_section: clinicalCase.case_flow?.sections?.[0]?.id || '',
            completed_sections: [],
            unlocked_sections: (clinicalCase.case_flow?.sections || [])
              .filter((section: any) => section.is_unlocked_initially)
              .map((section: any) => section.id),
            decisions_made: [],
            section_times: [],
          },
        } as any,
      } as any));

      this.logger.log('New case attempt started', {
        caseId,
        userId,
        attemptId: attempt.id,
      });
      return attempt;
    } catch (error) {
      this.logger.error('Error starting case attempt', {
        caseId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async updateProgress(
    attemptId: string,
    updateProgressDto: UpdateCaseProgressDto,
    userId: string,
  ): Promise<CaseAttempt> {
    try {
      const attempt: any = (await this.prisma.caseAttempt.findFirst({
        where: {
          id: attemptId,
          userId,
          status: CaseAttemptStatus.inProgress,
        } as any,
        include: { clinicalCase: true } as any,
      } as any));

      if (!attempt) {
        this.logger.warn('Active attempt not found', { attemptId, userId });
        throw new NotFoundException('Active attempt not found');
      }

      const progress: any = attempt.progress || {
        current_section: '',
        completed_sections: [],
        unlocked_sections: [],
        decisions_made: [],
        section_times: [],
      };

      // Update current section
      if (updateProgressDto.currentSection) {
        progress.current_section = updateProgressDto.currentSection;
      }

      // Handle decision point
      if (
        updateProgressDto.decisionPointId &&
        updateProgressDto.selectedOptionId
      ) {
        const decision = {
          decisionPointId: updateProgressDto.decisionPointId,
          selectedOptionId: updateProgressDto.selectedOptionId,
          timestamp: new Date(),
          points_earned: this.calculateDecisionPoints(
            attempt.clinicalCase,
            updateProgressDto.decisionPointId,
            updateProgressDto.selectedOptionId,
          ),
        };

        progress.decisions_made.push(decision);

        // Check for section unlocks
        const newUnlocks = this.checkSectionUnlocks(
          attempt.clinicalCase,
          updateProgressDto.decisionPointId,
          updateProgressDto.selectedOptionId,
        );
        progress.unlocked_sections.push(...newUnlocks);

        // Update score
        attempt.score += decision.points_earned;
      }

      // Update time tracking
      if (updateProgressDto.timeSpent) {
        const existingTimeIndex = progress.section_times.findIndex(
          (st: any) => st.section_id === updateProgressDto.currentSection,
        );

        if (existingTimeIndex >= 0) {
          progress.section_times[existingTimeIndex].time_spent +=
            updateProgressDto.timeSpent;
        } else {
          progress.section_times.push({
            sectionId: updateProgressDto.currentSection,
            timeSpent: updateProgressDto.timeSpent,
          });
        }

        attempt.time_spent_seconds += updateProgressDto.timeSpent;
      }

      const percentage = (attempt.score / attempt.max_score) * 100;

      const updatedAttempt: any = (await this.prisma.caseAttempt.update({
        where: { id: attemptId } as any,
        data: {
          progress,
          score: attempt.score,
          percentage,
          time_spent_seconds: attempt.time_spent_seconds,
        } as any,
      } as any));

      this.logger.log('Case attempt progress updated', { attemptId, userId });
      return updatedAttempt;
    } catch (error) {
      this.logger.error('Error updating case attempt progress', {
        attemptId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async submitDiagnosis(
    attemptId: string,
    submitDiagnosisDto: SubmitDiagnosisDto,
    userId: string,
  ): Promise<CaseAttempt> {
    try {
      const attempt: any = (await this.prisma.caseAttempt.findFirst({
        where: {
          id: attemptId,
          userId,
          status: CaseAttemptStatus.inProgress,
        } as any,
        include: { clinicalCase: true } as any,
      } as any));

      if (!attempt) {
        this.logger.warn('Active attempt not found', { attemptId, userId });
        throw new NotFoundException('Active attempt not found');
      }

      // Save clinical reasoning
      const diagnosticScore = this.calculateDiagnosticScore(
        attempt.clinicalCase,
        submitDiagnosisDto,
      );
      const score = attempt.score + diagnosticScore;
      const percentage = (score / attempt.max_score) * 100;

      const updatedAttempt: any = (await this.prisma.caseAttempt.update({
        where: { id: attemptId } as any,
        data: {
          clinical_reasoning: submitDiagnosisDto,
          score,
          percentage,
        } as any,
      } as any));

      this.logger.log('Diagnosis submitted', { attemptId, userId });
      return updatedAttempt;
    } catch (error) {
      this.logger.error('Error submitting diagnosis', {
        attemptId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async completeAttempt(
    attemptId: string,
    userId: string,
  ): Promise<CaseAttempt> {
    try {
      const attempt: any = (await this.prisma.caseAttempt.findFirst({
        where: {
          id: attemptId,
          userId,
          status: CaseAttemptStatus.inProgress,
        } as any,
        include: { clinicalCase: true } as any,
      } as any));

      if (!attempt) {
        this.logger.warn('Active attempt not found', { attemptId, userId });
        throw new NotFoundException('Active attempt not found');
      }

      const feedback = await this.generateFeedback(attempt);
      const analytics = this.generateAnalytics(attempt);

      const updatedAttempt: any = (await this.prisma.caseAttempt.update({
        where: { id: attemptId } as any,
        data: {
          status: CaseAttemptStatus.completed,
          completed_at: new Date(),
          feedback,
          analytics,
        } as any,
      } as any));

      this.logger.log('Case attempt completed', { attemptId, userId });
      return updatedAttempt;
    } catch (error) {
      this.logger.error('Error completing case attempt', {
        attemptId,
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  private calculateMaxScore(clinicalCase: any): number {
    let maxScore = 0;

    // Points from decision points
    clinicalCase.case_flow.decision_points?.forEach((dp: any) => {
      const maxOptionPoints = Math.max(
        ...dp.options.map((opt: any) => opt.points || 0),
      );
      maxScore += maxOptionPoints;
    });

    // Points from sections
    clinicalCase.case_flow.sections?.forEach((section: any) => {
      maxScore += section.points || 0;
    });

    // Diagnostic accuracy points (standard 100 points)
    maxScore += 100;

    return maxScore;
  }

  private calculateDecisionPoints(
    clinicalCase: any,
    decisionPointId: string,
    selectedOptionId: string,
  ): number {
    const decisionPoint = clinicalCase.case_flow.decision_points?.find(
      (dp: any) => dp.id === decisionPointId,
    );

    if (!decisionPoint) {
      return 0;
    }

    const selectedOption = decisionPoint.options.find(
      (opt: any) => opt.id === selectedOptionId,
    );
    return selectedOption?.points || 0;
  }

  private checkSectionUnlocks(
    clinicalCase: any,
    decisionPointId: string,
    selectedOptionId: string,
  ): string[] {
    const decisionPoint = clinicalCase.case_flow.decision_points?.find(
      (dp: any) => dp.id === decisionPointId,
    );

    if (!decisionPoint) {
      return [];
    }

    const selectedOption = decisionPoint.options.find(
      (opt: any) => opt.id === selectedOptionId,
    );
    return selectedOption?.unlocks_sections || [];
  }

  private calculateDiagnosticScore(
    clinicalCase: any,
    diagnosis: SubmitDiagnosisDto,
  ): number {
    if (!clinicalCase.diagnostic_criteria) {
      return 0;
    }

    let score = 0;

    // Check final diagnosis accuracy
    if (
      diagnosis.finalDiagnosis ===
      clinicalCase.diagnostic_criteria.final_diagnosis
    ) {
      score += 50; // 50 points for correct final diagnosis
    }

    // Check differential diagnoses
    const correctDifferentials =
      clinicalCase.diagnostic_criteria.differential_diagnoses?.map(
        (dd: any) => dd.diagnosis,
      ) || [];

    const identifiedCorrectDifferentials =
      diagnosis.differentialDiagnoses.filter((dd) =>
        correctDifferentials.includes(dd.diagnosis),
      );

    score += identifiedCorrectDifferentials.length * 10; // 10 points per correct differential

    // Check key findings identification
    const identifiedKeyFindings = diagnosis.keyFindingsIdentified.filter(
      (finding) =>
        clinicalCase.diagnostic_criteria.key_findings?.includes(finding),
    );

    score += identifiedKeyFindings.length * 5; // 5 points per key finding

    return Math.min(score, 100); // Cap at 100 points
  }

  private async generateFeedback(attempt: any): Promise<any> {
    return {
      overall_performance:
        attempt.percentage >= 80
          ? 'Excellent'
          : attempt.percentage >= 70
            ? 'Good'
            : attempt.percentage >= 60
              ? 'Satisfactory'
              : 'Needs Improvement',
      strengths: this.identifyStrengths(attempt),
      areas_for_improvement: this.identifyWeaknesses(attempt),
      specific_feedback: this.generateSectionFeedback(attempt),
      recommendations: await this.generateRecommendations(attempt),
    };
  }

  private generateAnalytics(attempt: any): any {
    return {
      decision_accuracy: this.calculateDecisionAccuracy(attempt),
      time_efficiency: this.calculateTimeEfficiency(attempt),
      clinical_reasoning_score: this.calculateClinicalReasoningScore(attempt),
      knowledge_gaps: this.identifyKnowledgeGaps(attempt),
      learning_objectives_met: this.checkLearningObjectives(attempt),
      difficulty_appropriate: this.assessDifficultyLevel(attempt),
    };
  }

  private identifyStrengths(_attempt: any): string[] {
    // TODO: Implement logic to identify strengths
    return [];
  }

  private identifyWeaknesses(_attempt: any): string[] {
    // TODO: Implement logic to identify weaknesses
    return [];
  }

  private generateSectionFeedback(_attempt: any): any[] {
    // TODO: Implement section-specific feedback
    return [];
  }

  private async generateRecommendations(attempt: any): Promise<any> {
    // Delegate recommendation generation to AIRecommendationService
    try {
      const userId = attempt.userId;
      if (!userId) {
        return { study_topics: [], resources: [], next_cases: [] };
      }
      const recs =
        await this.aiAnalyticsService.getPersonalizedRecommendations(userId);
      return {
        study_topics: recs.map((r: any) => r.materialId),
        resources: recs,
        next_cases: [],
      };
    } catch (error) {
      this.logger.error(
        'Error generating recommendations via AI service',
        error,
      );
      return { study_topics: [], resources: [], next_cases: [] };
    }
  }

  private calculateDecisionAccuracy(_attempt: any): number {
    // TODO: Implement decision accuracy calculation
    return 0;
  }

  private calculateTimeEfficiency(_attempt: any): number {
    // TODO: Implement time efficiency calculation
    return 0;
  }

  private calculateClinicalReasoningScore(_attempt: any): number {
    // TODO: Implement clinical reasoning score
    return 0;
  }

  private identifyKnowledgeGaps(_attempt: any): string[] {
    // TODO: Implement knowledge gap identification
    return [];
  }

  private checkLearningObjectives(_attempt: any): string[] {
    // TODO: Implement learning objectives assessment
    return [];
  }

  private assessDifficultyLevel(_attempt: any): boolean {
    // TODO: Implement difficulty assessment
    return true;
  }
}
