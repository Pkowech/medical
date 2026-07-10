// backend/src/modules/education/events/controllers/events.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from '../services/events.service';
import { CreateEventDto, UpdateEventDto } from '../dto/create-event.dto';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study event' })
  create(@Request() req: any, @Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(req.user.id, createEventDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all study events for the current user' })
  findAll(@Request() req: any) {
    return this.eventsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific study event' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.eventsService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a study event' })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, req.user.id, updateEventDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a study event' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.eventsService.remove(id, req.user.id);
  }
}
