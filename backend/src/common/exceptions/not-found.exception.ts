import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';

export class ResourceNotFoundException extends BaseException {
  readonly statusCode = HttpStatus.NOT_FOUND;
  readonly message: string;

  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

export class ResourceNotFoundByFieldException extends ResourceNotFoundException {
  readonly message: string;

  constructor(resource: string, field: string, value: string) {
    const msg = `${resource} with ${field} '${value}' not found`;
    super(msg);
    this.message = msg;
  }
}

export class QuestionNotFoundException extends ResourceNotFoundByFieldException {
  constructor(id: string) {
    super('Question', 'id', id);
  }
}

export class QuizQuestionNotFoundException extends ResourceNotFoundByFieldException {
  constructor(id: string) {
    super('QuizQuestion', 'id', id);
  }
}

export class QuizSessionNotFoundException extends ResourceNotFoundByFieldException {
  constructor(id: string) {
    super('QuizSession', 'id', id);
  }
}

export class AssessmentNotFoundException extends ResourceNotFoundByFieldException {
  constructor(id: string) {
    super('Assessment', 'id', id);
  }
}

export class UserNotFoundException extends ResourceNotFoundByFieldException {
  constructor(id: string) {
    super('User', 'id', id);
  }
}

export class MaximumAttemptsReachedException extends BaseException {
  readonly statusCode = HttpStatus.BAD_REQUEST; // or FORBIDDEN, depending on context
  readonly message = 'Maximum attempts reached';

  constructor() {
    super('Maximum attempts reached');
  }
}
