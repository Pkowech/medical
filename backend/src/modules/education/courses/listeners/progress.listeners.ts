// src/modules/progress/listeners/progress.listeners.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class ProgressListeners {
  private readonly logger = new Logger(ProgressListeners.name);

  @OnEvent('progress.updated')
  onProgressUpdated(payload: any) {
    // You can route more side-effects here later (badges, notifications, etc.)
    this.logger.debug('progress.updated event received', payload);
  }
}
