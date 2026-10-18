import { Injectable } from '@nestjs/common';
import { PrismaService } from '#infrastructure/prisma/prisma.service';

export type PerformanceDiagnosis =
  'prerequisite_gap' | 'target_content_gap' | 'insufficient_evidence';

export interface LearningResourceRecommendation {
  kind: 'material' | 'topic' | 'unit' | 'course' | 'prerequisite_diagnostic';
  id: string;
  title: string;
  href: string;
  reason: string;
}

export interface TopicPerformanceDiagnosis {
  topicId: string;
  topicName: string;
  accuracy: number;
  diagnosis: PerformanceDiagnosis;
  confidence: 'low' | 'medium' | 'high';
  prerequisiteEvidence: Array<{
    unitId: string;
    unitName: string;
    sampleSize: number;
    accuracy: number | null;
  }>;
  recommendations: LearningResourceRecommendation[];
}

export interface QuizPerformanceRecommendations {
  topics: TopicPerformanceDiagnosis[];
  recommendations: LearningResourceRecommendation[];
}

interface SubmittedAnswer {
  questionId: string;
  isCorrect: boolean;
}

interface UnitInfo {
  id: string;
  name: string;
  title: string | null;
  courseId: string;
  topics: Array<{ id: string; name: string }>;
}

@Injectable()
export class AssessmentRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async recommendForAnswers(
    userId: string,
    scope: {
      topicId?: string | null;
      unitId?: string | null;
      courseId?: string | null;
    },
    answers: SubmittedAnswer[],
  ): Promise<QuizPerformanceRecommendations> {
    if (!answers.length) return { topics: [], recommendations: [] };

    const questionIds = [
      ...new Set(answers.map((answer) => answer.questionId)),
    ];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, topicIds: true, unitId: true },
    });
    const answersByQuestion = new Map(
      answers.map((answer) => [answer.questionId, answer.isCorrect]),
    );
    const topicIds = [
      ...new Set([
        ...(scope.topicId ? [scope.topicId] : []),
        ...questions.flatMap((question) => question.topicIds),
      ]),
    ];
    if (!topicIds.length) return { topics: [], recommendations: [] };

    const topics = await this.prisma.topic.findMany({
      where: { id: { in: topicIds } },
      select: {
        id: true,
        name: true,
        unitId: true,
        unit: {
          select: {
            id: true,
            name: true,
            title: true,
            courseId: true,
            course: { select: { id: true, name: true, title: true } },
          },
        },
      },
    });
    const questionIdsByTopic = new Map<string, Set<string>>();
    for (const question of questions) {
      for (const topicId of question.topicIds) {
        const ids = questionIdsByTopic.get(topicId) ?? new Set<string>();
        ids.add(question.id);
        questionIdsByTopic.set(topicId, ids);
      }
    }

    const targetUnitIds = [...new Set(topics.map((topic) => topic.unitId))];
    const targetCourseIds = [
      ...new Set([
        ...topics.map((topic) => topic.unit.courseId),
        ...(scope.courseId ? [scope.courseId] : []),
      ]),
    ];

    const [unitRelations, courseRelations] = await Promise.all([
      this.prisma.unitRelation.findMany({
        where: {
          targetUnitId: { in: targetUnitIds },
          relationType: 'prerequisite',
        },
        include: {
          sourceUnit: {
            select: {
              id: true,
              name: true,
              title: true,
              courseId: true,
              topics: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.course.findMany({
        where: { id: { in: targetCourseIds } },
        select: {
          id: true,
          prerequisites: {
            include: {
              prerequisite: {
                select: {
                  id: true,
                  name: true,
                  title: true,
                  units: {
                    select: {
                      id: true,
                      name: true,
                      title: true,
                      courseId: true,
                      topics: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const unitsByTopic = new Map<string, Map<string, UnitInfo>>();
    for (const topic of topics) {
      const prerequisites = new Map<string, UnitInfo>();
      for (const relation of unitRelations) {
        if (relation.targetUnitId === topic.unitId) {
          prerequisites.set(relation.sourceUnit.id, relation.sourceUnit);
        }
      }
      for (const course of courseRelations) {
        if (course.id === topic.unit.courseId) {
          for (const relation of course.prerequisites) {
            for (const unit of relation.prerequisite.units) {
              prerequisites.set(unit.id, unit);
            }
          }
        }
      }
      unitsByTopic.set(topic.id, prerequisites);
    }

    const prerequisiteUnits = new Map<string, UnitInfo>();
    for (const units of unitsByTopic.values()) {
      for (const unit of units.values()) prerequisiteUnits.set(unit.id, unit);
    }
    const prerequisiteUnitIds = [...prerequisiteUnits.keys()];
    const prerequisiteTopicIds = [
      ...new Set(
        [...prerequisiteUnits.values()].flatMap((unit) =>
          unit.topics.map((topic) => topic.id),
        ),
      ),
    ];
    const unitIdByTopicId = new Map<string, string>();
    for (const unit of prerequisiteUnits.values()) {
      for (const topic of unit.topics) {
        unitIdByTopicId.set(topic.id, unit.id);
      }
    }
    const priorResponses =
      prerequisiteUnitIds.length || prerequisiteTopicIds.length
        ? await this.prisma.userResponse.findMany({
            where: {
              userId,
              question: {
                OR: [
                  { unitId: { in: prerequisiteUnitIds } },
                  { topicIds: { hasSome: prerequisiteTopicIds } },
                ],
              },
            },
            select: {
              isCorrect: true,
              question: { select: { unitId: true, topicIds: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : [];

    const evidenceByUnit = new Map<
      string,
      { correct: number; total: number }
    >();
    for (const response of priorResponses) {
      const responseUnitIds = new Set([
        ...(response.question.unitId &&
        prerequisiteUnitIds.includes(response.question.unitId)
          ? [response.question.unitId]
          : []),
        ...response.question.topicIds
          .map((topicId) => unitIdByTopicId.get(topicId))
          .filter((unitId): unitId is string => Boolean(unitId)),
      ]);
      for (const unitId of responseUnitIds) {
        const evidence = evidenceByUnit.get(unitId) ?? { correct: 0, total: 0 };
        evidence.total += 1;
        if (response.isCorrect) evidence.correct += 1;
        evidenceByUnit.set(unitId, evidence);
      }
    }

    const weakTopics = topics
      .map((topic) => {
        const questionIdsForTopic =
          questionIdsByTopic.get(topic.id) ?? new Set<string>();
        const topicAnswers = [...questionIdsForTopic]
          .filter((id) => answersByQuestion.has(id))
          .map((id) => answersByQuestion.get(id)!);
        const scopedAnswers = topicAnswers.length
          ? topicAnswers
          : scope.topicId === topic.id
            ? answers.map((answer) => answer.isCorrect)
            : [];
        const accuracy = scopedAnswers.length
          ? scopedAnswers.filter(Boolean).length / scopedAnswers.length
          : 1;
        return { topic, accuracy };
      })
      .filter((entry) => entry.accuracy < 0.7);

    const diagnoses: TopicPerformanceDiagnosis[] = [];
    for (const entry of weakTopics) {
      const targetUnit = entry.topic.unit;
      const targetCourse = targetUnit.course;
      const prerequisiteUnitsForTopic = [
        ...(unitsByTopic.get(entry.topic.id)?.values() ?? []),
      ];
      const prerequisiteEvidence = prerequisiteUnitsForTopic.map((unit) => {
        const evidence = evidenceByUnit.get(unit.id);
        return {
          unitId: unit.id,
          unitName: unit.title || unit.name,
          sampleSize: evidence?.total ?? 0,
          accuracy:
            evidence && evidence.total > 0
              ? evidence.correct / evidence.total
              : null,
        };
      });
      const hasCompleteEvidence =
        prerequisiteEvidence.length > 0 &&
        prerequisiteEvidence.every((item) => item.sampleSize >= 3);
      const weakPrerequisite = prerequisiteEvidence.filter(
        (item) =>
          item.sampleSize >= 3 && item.accuracy !== null && item.accuracy < 0.6,
      );
      const diagnosis: PerformanceDiagnosis = weakPrerequisite.length
        ? 'prerequisite_gap'
        : hasCompleteEvidence
          ? 'target_content_gap'
          : 'insufficient_evidence';
      const confidence =
        diagnosis === 'insufficient_evidence' ||
        !prerequisiteEvidence.every((item) => item.sampleSize >= 3)
          ? 'low'
          : prerequisiteEvidence.every((item) => item.sampleSize >= 10)
            ? 'high'
            : 'medium';
      const resourceTopics =
        diagnosis === 'prerequisite_gap'
          ? prerequisiteUnitsForTopic
              .filter((unit) =>
                weakPrerequisite.some((item) => item.unitId === unit.id),
              )
              .flatMap((unit) => unit.topics)
          : [entry.topic];
      const resourceTopicIds = [
        ...new Set(resourceTopics.map((topic) => topic.id)),
      ];
      const resourceUnitIds =
        diagnosis === 'prerequisite_gap'
          ? [
              ...new Set(
                prerequisiteUnitsForTopic
                  .filter((unit) =>
                    weakPrerequisite.some((item) => item.unitId === unit.id),
                  )
                  .map((unit) => unit.id),
              ),
            ]
          : [targetUnit.id];
      const resourceCourseIds = [
        ...new Set([
          ...(diagnosis === 'prerequisite_gap'
            ? resourceUnitIds
                .map(
                  (unitId) =>
                    prerequisiteUnitsForTopic.find((unit) => unit.id === unitId)
                      ?.courseId,
                )
                .filter((id): id is string => Boolean(id))
            : [targetCourse.id]),
        ]),
      ];
      const resources = await this.prisma.material.findMany({
        where: {
          AND: [
            { OR: [{ userId: null }, { userId }] },
            {
              OR: [
                ...(resourceTopicIds.length
                  ? [{ topicId: { in: resourceTopicIds } }]
                  : []),
                { unitId: { in: resourceUnitIds } },
                ...(resourceCourseIds.length
                  ? [{ courseId: { in: resourceCourseIds } }]
                  : []),
              ],
            },
          ],
        },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      });
      const recommendations: LearningResourceRecommendation[] = resources.map(
        (material) => ({
          kind: 'material',
          id: material.id,
          title: material.title,
          href: `/study-planner/materials/${material.id}`,
          reason:
            diagnosis === 'prerequisite_gap'
              ? 'Review this prerequisite material before retrying the target topic.'
              : 'Review material mapped to this topic before trying another assessment.',
        }),
      );

      for (const resourceTopic of resourceTopics) {
        const resourceUnit =
          diagnosis === 'prerequisite_gap'
            ? prerequisiteUnitsForTopic.find((unit) =>
                unit.topics.some((topic) => topic.id === resourceTopic.id),
              )
            : targetUnit;
        recommendations.push({
          kind: 'topic',
          id: resourceTopic.id,
          title: resourceTopic.name,
          href: `/courses/${resourceUnit?.courseId ?? targetCourse.id}/units/${resourceUnit?.id ?? targetUnit.id}?topicId=${resourceTopic.id}`,
          reason:
            diagnosis === 'prerequisite_gap'
              ? 'Strengthen a mapped prerequisite topic.'
              : 'Revisit the topic where your quiz answers indicate difficulty.',
        });
      }

      for (const unitId of resourceUnitIds) {
        const unit =
          prerequisiteUnitsForTopic.find((item) => item.id === unitId) ??
          targetUnit;
        recommendations.push({
          kind: 'unit',
          id: unit.id,
          title: unit.title || unit.name,
          href: `/quiz/unit/${unit.id}`,
          reason:
            diagnosis === 'insufficient_evidence'
              ? 'Take a short practice quiz here to check prerequisite knowledge.'
              : 'Review this unit to address the identified learning gap.',
        });
        if (
          diagnosis === 'insufficient_evidence' &&
          prerequisiteUnitsForTopic.length > 0
        ) {
          recommendations.push({
            kind: 'prerequisite_diagnostic',
            id: unit.id,
            title: `Check prerequisite knowledge: ${unit.title || unit.name}`,
            href: `/quiz/unit/${unit.id}`,
            reason:
              'There are not enough prior answers to tell whether the difficulty is foundational or topic-specific.',
          });
        }
      }

      if (diagnosis === 'prerequisite_gap') {
        for (const course of courseRelations) {
          if (course.id !== targetCourse.id) continue;
          for (const relation of course.prerequisites) {
            if (resourceCourseIds.includes(relation.prerequisite.id)) {
              recommendations.push({
                kind: 'course',
                id: relation.prerequisite.id,
                title:
                  relation.prerequisite.title || relation.prerequisite.name,
                href: `/courses/${relation.prerequisite.id}`,
                reason:
                  'This course is a mapped prerequisite for the area you struggled with.',
              });
            }
          }
        }
      } else {
        recommendations.push({
          kind: 'course',
          id: targetCourse.id,
          title: targetCourse.title || targetCourse.name,
          href: `/courses/${targetCourse.id}`,
          reason:
            'Continue with the course containing the topic you struggled with.',
        });
      }

      diagnoses.push({
        topicId: entry.topic.id,
        topicName: entry.topic.name,
        accuracy: entry.accuracy,
        diagnosis,
        confidence,
        prerequisiteEvidence,
        recommendations: this.uniqueRecommendations(recommendations),
      });
    }

    return {
      topics: diagnoses,
      recommendations: this.uniqueRecommendations(
        diagnoses.flatMap((diagnosis) => diagnosis.recommendations),
      ),
    };
  }

  private uniqueRecommendations(
    recommendations: LearningResourceRecommendation[],
  ): LearningResourceRecommendation[] {
    const seen = new Set<string>();
    return recommendations.filter((recommendation) => {
      const key = `${recommendation.kind}:${recommendation.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
