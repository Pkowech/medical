import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

export class AssessmentNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Assessment with ID ${id} not found`);
  }
}

export class QuizNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Quiz with ID ${id} not found`);
  }
}

export class QuestionNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Question with ID ${id} not found`);
  }
}

export class FlashcardNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Flashcard with ID ${id} not found`);
  }
}

export class MaximumAttemptsReachedException extends ForbiddenException {
  constructor(assessmentId: string) {
    super(`Maximum attempts reached for assessment ${assessmentId}`);
  }
}

export class AssessmentNotAvailableException extends ForbiddenException {
  constructor(reason?: string) {
    super(`Assessment is not available${reason ? `: ${reason}` : ''}`);
  }
}

export class InvalidAnswerFormatException extends BadRequestException {
  constructor(questionType: string) {
    super(`Invalid answer format for question type: ${questionType}`);
  }
}

export class QuizSessionExpiredException extends ForbiddenException {
  constructor(sessionId: string) {
    super(`Quiz session ${sessionId} has expired`);
  }
}
