import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '#modules/auth/guards/jwt-auth.guard';
import { NotesService } from '../services/notes.service';
import type { AuthenticatedRequest } from '#common/dto/user.dto';

@ApiTags('notes')
@Controller('notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() data: { topicId: string, materialId?: string, content: string, type?: 'student' | 'ai_generated' | 'peer_shared' }) {
    return this.notesService.createNote(req.user.id, data.topicId, data);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest, @Query('topicId') topicId: string, @Query('materialId') materialId?: string) {
    if (!topicId) throw new Error('topicId is required');
    return this.notesService.getNotes(req.user.id, topicId, materialId);
  }

  @Put(':id')
  update(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() data: { content: string }) {
    return this.notesService.updateNote(req.user.id, id, data.content);
  }

  @Delete(':id')
  delete(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notesService.deleteNote(req.user.id, id);
  }
}
