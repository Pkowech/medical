import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '#modules/auth/constants/role.constants';
import { ClinicalCasesService } from '../services/clinical-cases.service';
import { CaseComplexity, CaseSpecialty, CaseStatus } from '@prisma/client';
import {
  CreateClinicalCaseDto,
  UpdateCaseProgressDto,
  SubmitDiagnosisDto,
} from '../../../../common/dto/clinical-case.dto';

@ApiTags('clinical-cases')
@Controller('clinical-cases')
export class ClinicalCasesController {
  constructor(private readonly clinicalCasesService: ClinicalCasesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(Role.admin, Role.instructor)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new clinical case' })
  @ApiResponse({
    status: 201,
    description: 'Clinical case created successfully',
  })
  async create(
    @Request() req: ExpressRequest & { user: any },
    @Body() createClinicalCaseDto: CreateClinicalCaseDto,
  ) {
    return await this.clinicalCasesService.create(
      createClinicalCaseDto,
      req.user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all clinical cases with filtering' })
  @ApiQuery({
    name: 'course_id',
    required: false,
    description: 'Filter by course ID',
  })
  @ApiQuery({
    name: 'unit_id',
    required: false,
    description: 'Filter by unit ID',
  })
  @ApiQuery({ name: 'specialty', required: false, enum: CaseSpecialty })
  @ApiQuery({ name: 'complexity', required: false, enum: CaseComplexity })
  @ApiQuery({ name: 'status', required: false, enum: CaseStatus })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in title, description, and tags',
  })
  async findAll(
    @Query()
    filters: {
      course_id?: string;
      unit_id?: string;
      specialty?: CaseSpecialty;
      complexity?: CaseComplexity;
      status?: CaseStatus;
      search?: string;
    },
  ) {
    return await this.clinicalCasesService.findAll(filters);
  }

  @Get('specialties')
  @ApiOperation({ summary: 'Get available specialties' })
  getSpecialties() {
    return Object.values(CaseSpecialty).map((specialty: string) => ({
      value: specialty,
      label: specialty
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
    }));
  }

  @Get('complexities')
  @ApiOperation({ summary: 'Get available complexity levels' })
  getComplexities() {
    return Object.values(CaseComplexity).map((complexity: string) => ({
      value: complexity,
      label: complexity.charAt(0).toUpperCase() + complexity.slice(1),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get clinical case by ID' })
  @ApiResponse({ status: 200, description: 'Clinical case found' })
  @ApiResponse({ status: 404, description: 'Clinical case not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    const userId = req.user?.id;
    return await this.clinicalCasesService.findOne(id, userId);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a clinical case attempt' })
  @ApiResponse({
    status: 201,
    description: 'Case attempt started successfully',
  })
  @ApiResponse({ status: 404, description: 'Clinical case not found' })
  async startAttempt(
    @Param('id') caseId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return await this.clinicalCasesService.startAttempt(caseId, req.user.id);
  }

  @Patch('attempts/:attemptId/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update case attempt progress' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  async updateProgress(
    @Param('attemptId') attemptId: string,
    @Body() updateProgressDto: UpdateCaseProgressDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return await this.clinicalCasesService.updateProgress(
      attemptId,
      updateProgressDto,
      req.user.id,
    );
  }

  @Post('attempts/:attemptId/diagnosis')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit diagnosis for case attempt' })
  @ApiResponse({ status: 200, description: 'Diagnosis submitted successfully' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  async submitDiagnosis(
    @Param('attemptId') attemptId: string,
    @Body() submitDiagnosisDto: SubmitDiagnosisDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return await this.clinicalCasesService.submitDiagnosis(
      attemptId,
      submitDiagnosisDto,
      req.user.id,
    );
  }

  @Post('attempts/:attemptId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete case attempt and get final feedback' })
  @ApiResponse({
    status: 200,
    description: 'Case attempt completed successfully',
  })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  async completeAttempt(
    @Param('attemptId') attemptId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return await this.clinicalCasesService.completeAttempt(
      attemptId,
      req.user.id,
    );
  }

  @Get('attempts/:attemptId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get case attempt details' })
  @ApiResponse({ status: 200, description: 'Attempt details retrieved' })
  @ApiResponse({ status: 404, description: 'Attempt not found' })
  async getAttempt(
    @Param('attemptId') attemptId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return await this.clinicalCasesService.getAttempt(attemptId, req.user.id);
  }
}
