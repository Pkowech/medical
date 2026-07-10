import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidQuestionTypeException extends HttpException {
  constructor(type: string) {
    super(`Invalid question type: ${type}`, HttpStatus.BAD_REQUEST);
  }
}

export class SessionExpiredException extends HttpException {
  constructor(sessionId: string) {
    super(`Quiz session ${sessionId} has expired`, HttpStatus.GONE);
  }
}

export class MaxAttemptsExceededException extends HttpException {
  constructor(quizId: string) {
    super(`Maximum attempts exceeded for quiz ${quizId}`, HttpStatus.FORBIDDEN);
  }
}

export class QuizNotPublishedException extends HttpException {
  constructor(quizId: string) {
    super(`Quiz ${quizId} is not published`, HttpStatus.FORBIDDEN);
  }
}

export class InvalidAnswerFormatException extends HttpException {
  constructor(message: string) {
    super(`Invalid answer format: ${message}`, HttpStatus.BAD_REQUEST);
  }
}
