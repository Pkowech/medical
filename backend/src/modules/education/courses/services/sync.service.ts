// SYNC-001: Offline Conflict Resolution
// Handles conflicts between offline-made client changes and server state.
// Rules: server wins for quiz attempts, merge by timestamp for progress.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';
import { getErrorMessage } from '#common/utils/error.utils';

export type ResourceType = 'progress' | 'quiz_attempt' | 'study_session';

export interface ConflictResolution {
  resourceType: ResourceType;
  resourceId: string;
  resolution: 'server_wins' | 'client_wins' | 'merge';
  appliedData: Record<string, unknown>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a conflict between client and server state.
   * Quiz attempts: always server wins (prevent score manipulation).
   * Progress: merge by latest updatedAt timestamp.
   */
  async resolveConflict(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    clientData: Record<string, unknown>,
    serverData: Record<string, unknown>,
  ): Promise<ConflictResolution> {
    let resolution: 'server_wins' | 'client_wins' | 'merge';
    let appliedData: Record<string, unknown>;

    try {
      switch (resourceType) {
        case 'quiz_attempt':
          // Server always wins for quiz attempts — integrity critical
          resolution = 'server_wins';
          appliedData = serverData;
          break;

        case 'progress': {
          // Merge by latest timestamp
          const clientUpdated = new Date(clientData.updatedAt as string);
          const serverUpdated = new Date(serverData.updatedAt as string);

          if (clientUpdated > serverUpdated) {
            resolution = 'client_wins';
            appliedData = clientData;

            // Apply client changes to server
            await this.prisma.progress.updateMany({
              where: { id: resourceId, userId },
              data: {
                progressPercentage: clientData.progressPercentage as number,
                status: clientData.status as any,
                lastUpdated: clientUpdated.getTime(),
              },
            });
          } else {
            resolution = 'merge';
            appliedData = serverData;
          }
          break;
        }

        case 'study_session':
        default:
          // Merge: use server endTime if exists, client data for activities
          resolution = 'merge';
          appliedData = {
            ...serverData,
            activities: serverData.activities ?? clientData.activities,
          };
          break;
      }

      // Log the conflict resolution
      await this.prisma.syncLog.create({
        data: {
          userId,
          resourceType,
          resourceId,
          conflictType: 'client_server_divergence',
          resolution,
          resolvedAt: new Date(),
        },
      });

      return { resourceType, resourceId, resolution, appliedData };
    } catch (error) {
      this.logger.error(
        `Conflict resolution failed: ${getErrorMessage(error)}`,
      );
      return {
        resourceType,
        resourceId,
        resolution: 'server_wins',
        appliedData: serverData,
      };
    }
  }

  /**
   * Get unresolved sync conflicts for a user.
   */
  async getPendingConflicts(userId: string) {
    return this.prisma.syncLog.findMany({
      where: { userId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
