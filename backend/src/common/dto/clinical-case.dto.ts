// src/modules/courses/dto/clinical-case.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
} from 'class-validator';
import { CaseComplexity, ClinicalCase } from '@prisma/client';

export class CreateClinicalCaseDto {
  @ApiProperty({ description: 'Case title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Patient presentation' })
  @IsString()
  @IsNotEmpty()
  patientPresentation!: string;

  @ApiProperty({ description: 'Medical history' })
  @IsString()
  @IsNotEmpty()
  medicalHistory!: string;

  @ApiProperty({ enum: CaseComplexity, description: 'Case complexity level' })
  @IsEnum(CaseComplexity)
  complexity!: CaseComplexity;

  @ApiPropertyOptional({ description: 'Course ID if part of course' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Unit ID if part of unit' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Medical specialties involved' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ description: 'Learning objectives' })
  @IsOptional()
  @IsString()
  learningObjectives?: string;

  @ApiPropertyOptional({ description: 'Case discussion points' })
  @IsOptional()
  @IsString()
  discussionPoints?: string;
}

export class ClinicalCaseResponseDto {
  @ApiProperty({ description: 'Case ID' })
  id!: string;

  @ApiProperty({ description: 'Case title' })
  title!: string;

  @ApiProperty({ description: 'Patient presentation' })
  patientPresentation!: string;

  @ApiProperty({ description: 'Medical history' })
  medicalHistory!: string;

  @ApiProperty({ enum: CaseComplexity, description: 'Complexity level' })
  complexity!: CaseComplexity;

  @ApiPropertyOptional({ description: 'Associated specialties' })
  specialties?: string[];

  @ApiPropertyOptional({ description: 'Learning objectives' })
  learningObjectives?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'User completion status' })
  isCompleted?: boolean;

  @ApiPropertyOptional({ description: 'User progress on case' })
  progressPercentage?: number;
}

export class StartCaseAttemptDto {
  @ApiProperty({ description: 'Clinical case ID' })
  @IsString()
  caseId!: string;
}

export class UpdateCaseProgressDto {
  @ApiProperty({ description: 'Current section ID' })
  @IsString()
  currentSection!: string;

  @ApiPropertyOptional({ description: 'Current decision point ID' })
  @IsOptional()
  @IsString()
  decisionPointId?: string;

  @ApiPropertyOptional({ description: 'Selected option ID' })
  @IsOptional()
  @IsString()
  selectedOptionId?: string;

  @ApiPropertyOptional({
    description: 'Time spent in current section (seconds)',
  })
  @IsOptional()
  @IsNumber()
  timeSpent?: number;
}

export class DifferentialDiagnosisDto {
  @ApiProperty({ description: 'Diagnosis name' })
  diagnosis!: string;

  @ApiProperty({ description: 'Confidence level (0-100)' })
  confidence!: number;

  @ApiProperty({ description: 'Reasoning for this diagnosis' })
  reasoning!: string;

  @ApiProperty({ description: 'Timestamp of diagnosis' })
  timestamp!: Date;
}

export class TreatmentPlanDto {
  @ApiProperty({ description: 'Immediate actions', type: [String] })
  immediateActions!: string[];

  @ApiProperty({ description: 'Medications', type: [String] })
  medications!: string[];

  @ApiProperty({ description: 'Follow-up actions', type: [String] })
  followUp!: string[];
}

export class SubmitDiagnosisDto {
  @ApiProperty({
    description: 'Differential diagnoses with confidence and reasoning',
    type: () => [DifferentialDiagnosisDto],
  })
  @IsArray()
  differentialDiagnoses!: DifferentialDiagnosisDto[];

  @ApiProperty({ description: 'Final diagnosis' })
  @IsString()
  finalDiagnosis!: string;

  @ApiProperty({ description: 'Confidence level in final diagnosis (0-100)' })
  @IsNumber()
  diagnosticConfidence!: number;

  @ApiProperty({ type: [String], description: 'Key findings identified' })
  @IsArray()
  @IsString({ each: true })
  keyFindingsIdentified!: string[];

  @ApiProperty({ type: [String], description: 'Findings that were missed' })
  @IsArray()
  @IsString({ each: true })
  missedFindings!: string[];

  @ApiProperty({
    description: 'Treatment plan',
    type: () => TreatmentPlanDto,
  })
  @IsObject()
  treatmentPlan!: TreatmentPlanDto;
}

export interface CaseFlow {
  sections: CaseSection[];
  decisionPoints?: DecisionPoint[];
}

export interface CaseSection {
  id: string;
  isUnlockedInitially?: boolean;
  points?: number;
}

export interface DecisionPoint {
  id: string;
  options: DecisionOption[];
}

export interface DecisionOption {
  id: string;
  points?: number;
  unlockedSections?: string[];
}

export interface DiagnosticCriteria {
  finalDiagnosis: string;
  differentialDiagnoses?: Array<{ diagnosis: string }>;
  keyFindings?: string[];
}

export interface ExtendedClinicalCase extends ClinicalCase {
  caseFlow: CaseFlow;
  diagnosticCriteria?: DiagnosticCriteria;
  attempts?: CaseAttemptWithProgress[];
}

export interface CaseAttemptWithProgress {
  id: string;
  userId: string;
  caseId: string;
  score: number;
  maxScore?: number;
  percentage?: number;
  timeSpentSeconds?: number;
  completed: boolean;
  answers: JsonValue;
  feedback: JsonValue;
  progress?: {
    currentSection: string;
    completedSections: string[];
    unlockedSections: string[];
    decisionsMade: Array<{
      decisionPointId: string;
      selectedOptionId: string;
      timestamp: Date;
      pointsEarned: number;
    }>;
    sectionTimes: Array<{
      sectionId: string;
      timeSpent: number;
    }>;
  };
  startedAt: Date;
  completedAt?: Date;
  clinicalCase?: ExtendedClinicalCase;
}

type JsonValue = any;
