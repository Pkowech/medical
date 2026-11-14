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

export interface LearningSequenceStep {
  title: string;
  rationale: string;
  resources: LearningResourceRecommendation[];
}

export interface TopicPerformanceDiagnosis {
  topicId: string;
  topicName: string;
  accuracy: number;
  targetEvidence: {
    sampleSize: number;
    accuracy: number | null;
  };
  diagnosis: PerformanceDiagnosis;
  confidence: 'low' | 'medium' | 'high';
  prerequisiteEvidence: Array<{
    unitId: string;
    unitName: string;
    sampleSize: number;
    accuracy: number | null;
  }>;
  sequence: LearningSequenceStep[];
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

interface AttemptAccuracy {
  correct: number;
  total: number;
}

const recordAttemptAnswer = (
  attempts: Map<string, AttemptAccuracy>,
  attemptId: string,
  isCorrect: boolean,
) => {
  const accuracy = attempts.get(attemptId) ?? { correct: 0, total: 0 };
  accuracy.total += 1;
  if (isCorrect) accuracy.correct += 1;
  attempts.set(attemptId, accuracy);
};

const summarizeAttempts = (attempts: Map<string, AttemptAccuracy>) => {
  const scores = [...attempts.values()]
    .filter((attempt) => attempt.total > 0)
    .map((attempt) => attempt.correct / attempt.total);
  return {
    sampleSize: scores.length,
    accuracy: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
  };
};

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
    attemptId?: string,
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
    const [priorResponses, targetResponses] = await Promise.all([
      prerequisiteUnitIds.length || prerequisiteTopicIds.length
        ? this.prisma.userResponse.findMany({
            where: {
              ...(attemptId ? { attemptId: { not: attemptId } } : {}),
              attempt: { is: { completedAt: { not: null } } },
              userId,
              question: {
                OR: [
                  { unitId: { in: prerequisiteUnitIds } },
                  { topicIds: { hasSome: prerequisiteTopicIds } },
                ],
              },
            },
            select: {
              attemptId: true,
              isCorrect: true,
              question: { select: { unitId: true, topicIds: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : Promise.resolve([]),
      this.prisma.userResponse.findMany({
        where: {
          ...(attemptId ? { attemptId: { not: attemptId } } : {}),
          attempt: { is: { completedAt: { not: null } } },
          userId,
          question: { topicIds: { hasSome: topicIds } },
        },
        select: {
          attemptId: true,
          isCorrect: true,
          question: { select: { topicIds: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const evidenceByUnit = new Map<string, Map<string, AttemptAccuracy>>();
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
        const attempts = evidenceByUnit.get(unitId) ?? new Map();
        recordAttemptAnswer(attempts, response.attemptId, response.isCorrect);
        evidenceByUnit.set(unitId, attempts);
      }
    }

    const targetEvidenceByTopic = new Map<
      string,
      Map<string, AttemptAccuracy>
    >();
    for (const response of targetResponses) {
      for (const topicId of response.question.topicIds) {
        if (!topicIds.includes(topicId)) continue;
        const attempts = targetEvidenceByTopic.get(topicId) ?? new Map();
        recordAttemptAnswer(attempts, response.attemptId, response.isCorrect);
        targetEvidenceByTopic.set(topicId, attempts);
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
        const targetAttempts =
          targetEvidenceByTopic.get(topic.id) ??
          new Map<string, AttemptAccuracy>();
        if (scopedAnswers.length) {
          for (const isCorrect of scopedAnswers) {
            recordAttemptAnswer(
              targetAttempts,
              attemptId ?? `current:${topic.id}`,
              isCorrect,
            );
          }
          targetEvidenceByTopic.set(topic.id, targetAttempts);
        }
        const targetEvidence = summarizeAttempts(targetAttempts);
        return { topic, accuracy, targetEvidence };
      })
      .filter(
        (entry) =>
          entry.accuracy < 0.7 ||
          (entry.targetEvidence.accuracy !== null &&
            entry.targetEvidence.accuracy < 0.7),
      );

    const diagnoses: TopicPerformanceDiagnosis[] = [];
    for (const entry of weakTopics) {
      const targetUnit = entry.topic.unit;
      const targetCourse = targetUnit.course;
      const prerequisiteUnitsForTopic = [
        ...(unitsByTopic.get(entry.topic.id)?.values() ?? []),
      ];
      const prerequisiteEvidence = prerequisiteUnitsForTopic.map((unit) => {
        const attempts = evidenceByUnit.get(unit.id) ?? new Map();
        const evidence = summarizeAttempts(attempts);
        return {
          unitId: unit.id,
          unitName: unit.title || unit.name,
          sampleSize: evidence.sampleSize,
          accuracy: evidence.accuracy,
        };
      });
      const hasCompleteEvidence = prerequisiteEvidence.every(
        (item) => item.sampleSize >= 3,
      );
      const weakPrerequisite = prerequisiteEvidence.filter(
        (item) =>
          item.sampleSize >= 3 && item.accuracy !== null && item.accuracy < 0.6,
      );
      const diagnosis: PerformanceDiagnosis = weakPrerequisite.length
        ? 'prerequisite_gap'
        : hasCompleteEvidence &&
            entry.targetEvidence.sampleSize >= 3 &&
            (entry.targetEvidence.accuracy ?? 1) < 0.7
          ? 'target_content_gap'
          : 'insufficient_evidence';
      const relevantEvidenceCounts =
        diagnosis === 'prerequisite_gap'
          ? weakPrerequisite.map((item) => item.sampleSize)
          : [
              entry.targetEvidence.sampleSize,
              ...prerequisiteEvidence.map((item) => item.sampleSize),
            ];
      const minimumEvidence = Math.min(...relevantEvidenceCounts);
      const confidence =
        diagnosis === 'insufficient_evidence' || minimumEvidence < 3
          ? 'low'
          : minimumEvidence >= 10
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

      const targetResources: LearningResourceRecommendation[] = [
        {
          kind: 'topic',
          id: entry.topic.id,
          title: entry.topic.name,
          href: `/courses/${targetCourse.id}/units/${targetUnit.id}?topicId=${entry.topic.id}`,
          reason:
            'Return to this topic after reviewing the recommended foundations.',
        },
        {
          kind: 'course',
          id: targetCourse.id,
          title: targetCourse.title || targetCourse.name,
          href: `/courses/${targetCourse.id}`,
          reason:
            'Continue learning in the course that contains the target topic.',
        },
      ];
      const sequence: LearningSequenceStep[] = [];
      if (diagnosis === 'insufficient_evidence') {
        const diagnostics = recommendations.filter(
          (item) => item.kind === 'prerequisite_diagnostic',
        );
        sequence.push({
          title: 'Check prerequisite knowledge',
          rationale:
            'More evidence is needed to tell whether this difficulty comes from a missing foundation.',
          resources:
            diagnostics.length > 0
              ? diagnostics
              : recommendations.filter((item) => item.kind === 'unit'),
        });
      } else if (diagnosis === 'prerequisite_gap') {
        sequence.push({
          title: 'Strengthen prerequisite foundations',
          rationale:
            'Repeated completed attempts show difficulty in mapped prerequisite units.',
          resources: recommendations,
        });
      }

      if (diagnosis !== 'prerequisite_gap') {
        sequence.push({
          title: 'Review the target topic',
          rationale:
            diagnosis === 'target_content_gap'
              ? 'Prerequisite evidence is adequate; focus review on the target topic.'
              : 'Use the target materials while gathering more evidence.',
          resources: recommendations.filter(
            (item) => item.kind !== 'prerequisite_diagnostic',
          ),
        });
      } else {
        sequence.push({
          title: 'Return to the target topic',
          rationale:
            'After strengthening the prerequisites, revisit the original topic.',
          resources: targetResources,
        });
      }

      sequence.push({
        title: 'Reassess progress',
        rationale:
          'Take the target unit quiz again to check whether the review resolved the gap.',
        resources: [
          {
            kind: 'unit',
            id: targetUnit.id,
            title: `Reassess: ${targetUnit.title || targetUnit.name}`,
            href: `/quiz/unit/${targetUnit.id}`,
            reason: 'Use a new completed attempt to measure progress.',
          },
        ],
      });

      diagnoses.push({
        topicId: entry.topic.id,
        topicName: entry.topic.name,
        accuracy: entry.accuracy,
        targetEvidence: entry.targetEvidence,
        diagnosis,
        confidence,
        prerequisiteEvidence,
        sequence,
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
