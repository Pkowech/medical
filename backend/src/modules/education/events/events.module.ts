// backend/src/modules/education/events/events.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '#infrastructure/prisma/prisma.module';
import { EventsService } from './services/events.service';
import { DeadlinesService } from './services/deadlines.service';
import { EventsController } from './controllers/events.controller';
import { DeadlinesController } from './controllers/deadlines.controller';
import { AuthModule } from '../../auth/auth.module';

import { DeadlinesTask } from './tasks/deadlines.task';
import { EngagementCommunicationModule } from '../../engagement-communication/engagement-communication.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    forwardRef(() => EngagementCommunicationModule),
  ],
  controllers: [EventsController, DeadlinesController],
  providers: [EventsService, DeadlinesService, DeadlinesTask],
  exports: [EventsService, DeadlinesService],
})
export class EventsModule {}
