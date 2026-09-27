import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async createNote(userId: string, topicId: string, data: { content: string, materialId?: string, type?: 'student' | 'ai_generated' | 'peer_shared' }) {
    return this.prisma.note.create({
      data: {
        userId,
        topicId,
        materialId: data.materialId,
        content: data.content,
        type: data.type || 'student',
      },
    });
  }

  async getNotes(userId: string, topicId: string, materialId?: string) {
    return this.prisma.note.findMany({
      where: {
        userId,
        topicId,
        ...(materialId ? { materialId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateNote(userId: string, noteId: string, content: string) {
    const existing = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Note not found');
    }

    // Save previous version
    await this.prisma.noteVersion.create({
      data: {
        noteId,
        content: existing.content,
      },
    });

    return this.prisma.note.update({
      where: { id: noteId },
      data: { content, isStale: false }, // Reset staleness on edit
    });
  }

  async deleteNote(userId: string, noteId: string) {
    const existing = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Note not found');
    }
    return this.prisma.note.delete({ where: { id: noteId } });
  }
}
