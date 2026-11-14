import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const QUESTION_FLAG_ISSUES = [
  'ambiguous',
  'incorrect',
  'outdated',
  'inappropriate',
] as const;

export type QuestionFlagIssue = (typeof QUESTION_FLAG_ISSUES)[number];

export class CreateQuestionFlagDto {
  @IsUUID()
  questionId!: string;

  @IsIn(QUESTION_FLAG_ISSUES)
  issue!: QuestionFlagIssue;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class DecideQuestionModerationDto {
  @IsIn(['resolved', 'dismissed'])
  status!: 'resolved' | 'dismissed';

  @IsOptional()
  @IsIn([
    'no_issue_found',
    'instructor_action_required',
    'content_corrected',
    'question_withdrawn',
  ])
  resolution?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
