// src/modules/education/courses/listeners/xapi.listeners.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { XapiService } from '../services/xapi.service';

@Injectable()
export class XapiListeners {
  private readonly logger = new Logger(XapiListeners.name);

  constructor(private readonly xapiService: XapiService) {}

  @OnEvent('xapi.statement')
  async handleXapiStatement(payload: any) {
    try {
      this.logger.debug('Handling xapi.statement event', payload);
      await this.xapiService.saveStatement(payload, payload.actor?.userId);
    } catch (error: any) {
      this.logger.error(
        `Failed to handle xapi.statement event: ${error.message}`,
      );
    }
  }
}
