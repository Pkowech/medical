// LONG-002: Weakness Chain Detection
// Detects when a weakness in one topic creates risk in downstream (dependent) topics.
// Maps topic dependencies using UnitRelation (since topics inherit dependencies from their units).

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

export interface WeaknessChain {
  weakTopic: { id: string; name: string; pKnown: number };
  dependentTopics: Array<{ id: string; name: string; unitName: string }>;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

@Injectable()
export class WeaknessChainService {
  private readonly logger = new Logger(WeaknessChainService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detects weakness chains for a user by finding topics with low pKnown,
   * checking their unit dependencies, and flagging downstream topics at risk.
   */
  async detectWeaknessChains(userId: string): Promise<WeaknessChain[]> {
    const chains: WeaknessChain[] = [];

    // 1. Find topics where the user has a weakness (pKnown < 0.7)
    const weakStates = await this.prisma.userSkillState.findMany({
      where: {
        userId,
        pKnown: { lt: 0.7 },
      },
      include: {
        skill: {
          select: { id: true, name: true, unitId: true },
        },
      },
    });

    if (weakStates.length === 0) {
      return chains;
    }

    // 2. Map unit dependencies to find downstream risks
    for (const state of weakStates) {
      if (!state.skill.unitId) {
        continue;
      }

      // Find units that depend on this weak topic's unit
      const dependentRelations = await this.prisma.unitRelation.findMany({
        where: {
          sourceUnitId: state.skill.unitId,
          relationType: 'prerequisite',
        },
        include: {
          targetUnit: {
            include: {
              topics: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (dependentRelations.length === 0) {
        continue;
      }

      const dependentTopics = [];
      for (const rel of dependentRelations) {
        for (const targetTopic of rel.targetUnit.topics) {
          dependentTopics.push({
            id: targetTopic.id,
            name: targetTopic.name,
            unitName: rel.targetUnit.name,
          });
        }
      }

      if (dependentTopics.length > 0) {
        let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (state.pKnown < 0.4) {
          riskLevel = 'HIGH';
        } else if (state.pKnown < 0.6) {
          riskLevel = 'MEDIUM';
        }

        chains.push({
          weakTopic: {
            id: state.skill.id,
            name: state.skill.name,
            pKnown: state.pKnown,
          },
          dependentTopics,
          riskLevel,
        });
      }
    }

    return chains;
  }
}
