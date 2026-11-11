import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiAnalyticsService } from './ai-analytics.service';

type OnboardingCompletedPayload = {
  userId: string;
  timestamp: string;
  data: {
    healthcareField: string;
    careerStage: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOnboardingCompletedPayload(
  payload: unknown,
): payload is OnboardingCompletedPayload {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return false;
  }

  return (
    typeof payload.userId === 'string' &&
    payload.userId.length > 0 &&
    typeof payload.timestamp === 'string' &&
    Number.isFinite(Date.parse(payload.timestamp)) &&
    typeof payload.data.healthcareField === 'string' &&
    typeof payload.data.careerStage === 'string'
  );
}

@Injectable()
export class OnboardingCompletedListener {
  constructor(private readonly aiAnalyticsService: AiAnalyticsService) {}

  @OnEvent('user.onboarding.completed', { async: true })
  async handle(payload: unknown): Promise<void> {
    if (!isOnboardingCompletedPayload(payload)) {
      throw new Error('Invalid user.onboarding.completed event payload');
    }

    await this.aiAnalyticsService.trackEvent(
      payload.userId,
      'user.onboarding.completed',
      {
        healthcareField: payload.data.healthcareField,
        careerStage: payload.data.careerStage,
      },
      payload.timestamp,
      `onboarding-completed:${payload.userId}:${payload.timestamp}`,
    );
  }
}
