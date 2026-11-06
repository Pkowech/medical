import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '#infrastructure/metrics/metrics.service';
import { performance } from 'node:perf_hooks';

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

@Injectable()
export class PasswordVerificationGate {
  private readonly maxConcurrent: number;
  private readonly maxQueued: number;
  private readonly queueTimeoutMs: number;
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.maxConcurrent = config.get<number>(
      'AUTH_MAX_CONCURRENT_PASSWORD_VERIFICATIONS',
      2,
    );
    this.maxQueued = this.maxConcurrent * 2;
    this.queueTimeoutMs = config.get<number>(
      'AUTH_PASSWORD_VERIFICATION_QUEUE_TIMEOUT_MS',
      1500,
    );
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const queuedAt = performance.now();
    try {
      await this.acquire();
      this.metrics.recordAuthStage(
        'password_gate_wait',
        performance.now() - queuedAt,
        'success',
      );
    } catch (error) {
      this.metrics.recordAuthStage(
        'password_gate_wait',
        performance.now() - queuedAt,
        'rejected',
      );
      throw error;
    }

    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }

    if (this.queue.length >= this.maxQueued) {
      throw new ServiceUnavailableException(
        'Authentication is temporarily busy. Please try again shortly.',
      );
    }

    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(
              new ServiceUnavailableException(
                'Authentication is temporarily busy. Please try again shortly.',
              ),
            );
          }
        }, this.queueTimeoutMs),
      };
      this.queue.push(waiter);
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
      return;
    }

    this.active -= 1;
  }
}
