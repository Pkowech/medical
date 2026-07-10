import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import {
  StudyGroupType,
  StudyGroupPrivacy,
  Prisma,
  StudyGroup,
  StudyGroupMember,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudyGroupDto {
  @ApiProperty({ description: 'Study group name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Study group description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: StudyGroupType, description: 'Type of study group' })
  @IsEnum(StudyGroupType)
  type!: StudyGroupType;

  @ApiProperty({
    enum: StudyGroupPrivacy,
    description: 'Privacy setting of the study group',
  })
  @IsEnum(StudyGroupPrivacy)
  privacy!: StudyGroupPrivacy;

  @ApiPropertyOptional({ description: 'Maximum number of members' })
  @IsOptional()
  @IsNumber()
  maxMembers?: number;

  @ApiPropertyOptional({
    description: 'Tags for the study group',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Study topics', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studyTopics?: string[];

  @ApiPropertyOptional({ description: 'Goals of the study group' })
  @IsOptional()
  goals?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Schedule of the study group' })
  @IsOptional()
  schedule?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Rules of the study group' })
  @IsOptional()
  rules?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Associated course ID' })
  @IsOptional()
  @IsString()
  courseId?: string;
}

export class UpdateStudyGroupDto {
  @ApiPropertyOptional({ description: 'Study group name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Study group description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: StudyGroupType,
    description: 'Type of study group',
  })
  @IsOptional()
  @IsEnum(StudyGroupType)
  type?: StudyGroupType;

  @ApiPropertyOptional({
    enum: StudyGroupPrivacy,
    description: 'Privacy setting of the study group',
  })
  @IsOptional()
  @IsEnum(StudyGroupPrivacy)
  privacy?: StudyGroupPrivacy;

  @ApiPropertyOptional({ description: 'Maximum number of members' })
  @IsOptional()
  @IsNumber()
  maxMembers?: number;

  @ApiPropertyOptional({
    description: 'Tags for the study group',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Study topics', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studyTopics?: string[];

  @ApiPropertyOptional({ description: 'Goals of the study group' })
  @IsOptional()
  goals?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Schedule of the study group' })
  @IsOptional()
  schedule?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Rules of the study group' })
  @IsOptional()
  rules?: Prisma.JsonValue;

  @ApiPropertyOptional({ description: 'Associated course ID' })
  @IsOptional()
  @IsString()
  courseId?: string;
}

export class JoinGroupDto {
  @ApiPropertyOptional({ description: 'Invite code to join a private group' })
  @IsOptional()
  @IsString()
  inviteCode?: string;

  @ApiPropertyOptional({ description: 'Message to send with join request' })
  @IsOptional()
  @IsString()
  message?: string;
}

export interface StudyGroupMetadata {
  tags: string[];
  studyTopics: string[];
  goals: Prisma.JsonValue;
  schedule: Prisma.JsonValue;
  rules: Prisma.JsonValue;
  memberCount: number;
  inviteCode?: string;
}

export type StudyGroupDetails = StudyGroup & {
  userMembership?: StudyGroupMember | null;
  isMember?: boolean;
};
