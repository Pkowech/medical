'use client';

import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, Clock3, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAssessments, type Assessment } from '@/features/assessment/services/assessmentService';
import type { Course } from '@/shared/types/courseInterface';
import { unitService, type Unit } from '@/features/courses/services/unitService';
import {
  learningPathService,
  type CreateLearningPathPayload,
  type InstructorLearningPath,
} from '@/features/learning-management/services/learningPathService';

const CAREER_STAGES = [
  { value: 'student', label: 'Student' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'professional', label: 'Professional' },
] as const;

const PATH_CATEGORIES = [
  { value: 'medicine', label: 'Medicine' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'alliedHealth', label: 'Allied health' },
] as const;

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const;

interface PathPhaseDraft {
  id: string;
  title: string;
  description: string;
  courseId: string;
  contentMode: 'course' | 'units';
  unitIds: string[];
  quizIds: string[];
  milestone: string;
}

interface InstructorLearningPathManagerProps {
  instructorId: string;
  courses: Course[];
  onOpenCourses: () => void;
}

const createPhaseDraft = (): PathPhaseDraft => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  courseId: '',
  contentMode: 'course',
  unitIds: [],
  quizIds: [],
  milestone: '',
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error || typeof error !== 'object') return fallback;
  if ('response' in error && error.response && typeof error.response === 'object') {
    const response = error.response as { data?: { message?: unknown } };
    if (typeof response.data?.message === 'string') return response.data.message;
    if (
      Array.isArray(response.data?.message) &&
      response.data.message.every((message): message is string => typeof message === 'string')
    ) {
      return response.data.message.join(' ');
    }
  }
  if ('message' in error && typeof error.message === 'string') return error.message;
  return fallback;
};

const createEmptyPath = () => ({
  title: '',
  description: '',
  category: '',
  difficulty: '',
  estimatedDurationWeeks: 1,
  estimatedHoursPerWeek: 1,
  targetCareerStages: [] as string[],
  objectivesText: '',
  phases: [createPhaseDraft()],
});

export function InstructorLearningPathManager({
  instructorId,
  courses,
  onOpenCourses,
}: InstructorLearningPathManagerProps) {
  const [paths, setPaths] = useState<InstructorLearningPath[]>([]);
  const [quizzes, setQuizzes] = useState<Assessment[]>([]);
  const [quizzesError, setQuizzesError] = useState('');
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [pathListLoading, setPathListLoading] = useState(true);
  const [pathListError, setPathListError] = useState('');
  const [pathFormError, setPathFormError] = useState('');
  const [form, setForm] = useState(createEmptyPath);
  const [isSaving, setIsSaving] = useState(false);
  const [publishingPathId, setPublishingPathId] = useState<string | null>(null);
  const [unitsByCourseId, setUnitsByCourseId] = useState<Record<string, Unit[]>>({});
  const [loadingUnitsForCourse, setLoadingUnitsForCourse] = useState<Set<string>>(new Set());
  const [unitLoadErrors, setUnitLoadErrors] = useState<Record<string, string>>({});

  const publishedCourses = courses.filter(course => course.status === 'published');

  const loadPaths = async () => {
    setPathListLoading(true);
    setPathListError('');
    try {
      setPaths(await learningPathService.getAuthoredPaths(instructorId));
    } catch (error) {
      console.error('Failed to load instructor learning paths:', error);
      setPathListError(getErrorMessage(error, 'Could not load your learning paths.'));
    } finally {
      setPathListLoading(false);
    }
  };

  useEffect(() => {
    void loadPaths();
  }, [instructorId]);

  useEffect(() => {
    let active = true;
    fetchAssessments()
      .then(items => {
        if (active) setQuizzes(items);
      })
      .catch(error => {
        console.error('Failed to load published quizzes for path builder:', error);
        if (active) {
          setQuizzesError(getErrorMessage(error, 'Published quizzes could not be loaded.'));
        }
      })
      .finally(() => {
        if (active) setQuizzesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updatePhase = (phaseId: string, updates: Partial<PathPhaseDraft>) => {
    setForm(current => ({
      ...current,
      phases: current.phases.map(phase =>
        phase.id === phaseId ? { ...phase, ...updates } : phase,
      ),
    }));
  };

  const loadCourseUnits = async (courseId: string) => {
    if (!courseId || unitsByCourseId[courseId] || loadingUnitsForCourse.has(courseId)) return;
    setLoadingUnitsForCourse(current => new Set(current).add(courseId));
    setUnitLoadErrors(current => {
      const next = { ...current };
      delete next[courseId];
      return next;
    });
    try {
      const units = await unitService.getUnitsByCourseId(courseId);
      setUnitsByCourseId(current => ({
        ...current,
        [courseId]: units.filter(unit => unit.isPublished !== false && unit.status !== 'inactive'),
      }));
    } catch (error) {
      console.error(`Failed to load units for course ${courseId}:`, error);
      setUnitLoadErrors(current => ({
        ...current,
        [courseId]: getErrorMessage(error, 'Could not load units for this course.'),
      }));
    } finally {
      setLoadingUnitsForCourse(current => {
        const next = new Set(current);
        next.delete(courseId);
        return next;
      });
    }
  };

  const togglePhaseUnit = (phase: PathPhaseDraft, unitId: string) => {
    updatePhase(phase.id, {
      unitIds: phase.unitIds.includes(unitId)
        ? phase.unitIds.filter(id => id !== unitId)
        : [...phase.unitIds, unitId],
    });
  };

  const toggleCareerStage = (stage: string) => {
    setForm(current => ({
      ...current,
      targetCareerStages: current.targetCareerStages.includes(stage)
        ? current.targetCareerStages.filter(value => value !== stage)
        : [...current.targetCareerStages, stage],
    }));
  };

  const buildPayload = (): CreateLearningPathPayload | null => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description || !form.category || !form.difficulty) {
      setPathFormError('Complete the path details before saving.');
      return null;
    }
    if (form.targetCareerStages.length === 0) {
      setPathFormError('Choose at least one target learner stage.');
      return null;
    }
    if (form.phases.some(phase =>
      !phase.title.trim() ||
      !phase.courseId ||
      (phase.contentMode === 'units' && phase.unitIds.length === 0),
    )) {
      setPathFormError(
        'Give every phase a title, select a published course, and choose at least one unit when using selected-units mode.',
      );
      return null;
    }
    if (form.phases.some(phase => phase.contentMode === 'units' &&
      phase.unitIds.some(unitId => !(unitsByCourseId[phase.courseId] || []).some(unit => unit.id === unitId)),
    )) {
      setPathFormError('Reload the selected course units and choose from the available units.');
      return null;
    }
    if (
      form.phases.some(phase =>
        phase.quizIds.some(quizId =>
          !quizzes.some(quiz =>
            quiz.id === quizId &&
            (!quiz.courseId || quiz.courseId === phase.courseId),
          ),
        ),
      )
    ) {
      setPathFormError('A selected quiz is not available for its course. Choose another quiz.');
      return null;
    }
    const selectedQuizIds = form.phases.flatMap(phase => phase.quizIds);
    if (new Set(selectedQuizIds).size !== selectedQuizIds.length) {
      setPathFormError('Add each quiz to only one phase so its progress is tracked at the right stage.');
      return null;
    }

    const objectives = form.objectivesText
      .split('\n')
      .map(objective => objective.trim())
      .filter(Boolean);

    return {
      title,
      description,
      targetCareerStages: form.targetCareerStages,
      category: form.category,
      difficulty: form.difficulty,
      estimatedDurationWeeks: form.estimatedDurationWeeks,
      estimatedHoursPerWeek: form.estimatedHoursPerWeek,
      learningObjectives: objectives,
      pathStructure: {
        id: crypto.randomUUID(),
        title,
        description,
        modules: [],
        phases: form.phases.map((phase, phaseIndex) => {
          const course = publishedCourses.find(item => item.id === phase.courseId);
          if (!course) {
            throw new Error('A selected course is no longer available. Reload and try again.');
          }

          const courseModule = {
            id: crypto.randomUUID(),
            type: 'course' as const,
            resourceId: course.id,
            title: course.title || course.name,
            description: course.description || '',
            order: 1,
            required: true,
            estimatedMinutes: course.estimatedHours
              ? Math.round(course.estimatedHours * 60)
              : undefined,
          };
          const selectedUnits = (unitsByCourseId[course.id] || []).filter(unit =>
            phase.unitIds.includes(unit.id),
          );
          const modules: CreateLearningPathPayload['pathStructure']['phases'][number]['modules'] =
            phase.contentMode === 'course'
              ? [courseModule]
              : selectedUnits.map((unit, unitIndex) => ({
                  id: crypto.randomUUID(),
                  type: 'unit' as const,
                  resourceId: unit.id,
                  unitId: unit.id,
                  courseId: course.id,
                  title: unit.title || unit.name || 'Untitled unit',
                  description: unit.description || '',
                  order: unitIndex + 1,
                  required: true,
                  estimatedMinutes: unit.estimatedMinutes ?? unit.estimatedDuration,
                }));
          const phaseQuizzes = phase.quizIds
            .map(id => quizzes.find(item => item.id === id))
            .filter((quiz): quiz is Assessment => Boolean(quiz));
          for (const quiz of phaseQuizzes) {
            modules.push({
              id: crypto.randomUUID(),
              type: 'assessment',
              resourceId: quiz.id,
              title: quiz.title,
              description: quiz.description,
              estimatedMinutes: quiz.timeLimitMinutes,
              order: modules.length + 1,
              required: true,
            });
          }
          if (phase.milestone.trim()) {
            modules.push({
              id: crypto.randomUUID(),
              type: 'milestone' as const,
              resourceId: crypto.randomUUID(),
              title: phase.milestone.trim(),
              description: '',
              order: modules.length + 1,
              required: true,
            });
          }

          return {
            id: crypto.randomUUID(),
            title: phase.title.trim(),
            description: phase.description.trim(),
            order: phaseIndex + 1,
            modules,
          };
        }),
      },
    };
  };

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPathFormError('');
    const payload = buildPayload();
    if (!payload) return;

    setIsSaving(true);
    try {
      await learningPathService.createLearningPath(payload);
      toast.success('Learning path saved as a draft.');
      setForm(createEmptyPath());
      await loadPaths();
    } catch (error) {
      console.error('Failed to save learning path:', error);
      setPathFormError(getErrorMessage(error, 'Could not save this learning path.'));
    } finally {
      setIsSaving(false);
    }
  };

  const publishPath = async (pathId: string) => {
    setPublishingPathId(pathId);
    setPathListError('');
    try {
      const publishedPath = await learningPathService.publishLearningPath(pathId);
      setPaths(current => current.map(path =>
        path.id === publishedPath.id ? publishedPath : path,
      ));
      toast.success('Learning path published.');
    } catch (error) {
      console.error('Failed to publish learning path:', error);
      setPathListError(getErrorMessage(error, 'Could not publish this path.'));
    } finally {
      setPublishingPathId(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-primary">Path builder</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Create a learning path</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize full courses or selected units into phases, set learning objectives, and add checkpoints.
          </p>
        </div>

        {publishedCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
            <p className="font-medium text-foreground">Publish a course first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A path can include a whole published course or selected published units from it.
            </p>
            <button
              type="button"
              onClick={onOpenCourses}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Open course management
            </button>
          </div>
        ) : (
          <form onSubmit={saveDraft} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="path-title" className="mb-1.5 block text-sm font-medium">Path title</label>
                <input
                  id="path-title"
                  value={form.title}
                  onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                  maxLength={255}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Core Clinical Pharmacy"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="path-description" className="mb-1.5 block text-sm font-medium">Description</label>
                <textarea
                  id="path-description"
                  value={form.description}
                  onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                  rows={3}
                  maxLength={2000}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Describe who this path is for and what learners will achieve."
                />
              </div>
              <div>
                <label htmlFor="path-category" className="mb-1.5 block text-sm font-medium">Healthcare field</label>
                <select
                  id="path-category"
                  value={form.category}
                  onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select a field</option>
                  {PATH_CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="path-difficulty" className="mb-1.5 block text-sm font-medium">Difficulty</label>
                <select
                  id="path-difficulty"
                  value={form.difficulty}
                  onChange={event => setForm(current => ({ ...current, difficulty: event.target.value }))}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select difficulty</option>
                  {DIFFICULTIES.map(difficulty => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="path-weeks" className="mb-1.5 block text-sm font-medium">Duration (weeks)</label>
                <input
                  id="path-weeks"
                  type="number"
                  min={1}
                  max={52}
                  value={form.estimatedDurationWeeks}
                  onChange={event => setForm(current => ({
                    ...current,
                    estimatedDurationWeeks: Number(event.target.value),
                  }))}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="path-hours" className="mb-1.5 block text-sm font-medium">Study hours per week</label>
                <input
                  id="path-hours"
                  type="number"
                  min={1}
                  max={40}
                  value={form.estimatedHoursPerWeek}
                  onChange={event => setForm(current => ({
                    ...current,
                    estimatedHoursPerWeek: Number(event.target.value),
                  }))}
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Target learners</legend>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">
                Choose at least one stage; learners use this to find suitable paths.
              </p>
              <div className="flex flex-wrap gap-2">
                {CAREER_STAGES.map(stage => {
                  const checked = form.targetCareerStages.includes(stage.value);
                  return (
                    <label
                      key={stage.value}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                        checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCareerStage(stage.value)}
                        className="accent-primary"
                      />
                      {stage.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="path-objectives" className="mb-1.5 block text-sm font-medium">
                Learning objectives <span className="font-normal text-muted-foreground">(one per line)</span>
              </label>
              <textarea
                id="path-objectives"
                value={form.objectivesText}
                onChange={event => setForm(current => ({ ...current, objectivesText: event.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={'Apply safe medication practices\nInterpret common clinical cases'}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Path phases</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add a whole course or selected units, plus optional checkpoint quizzes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(current => ({
                    ...current,
                    phases: [...current.phases, createPhaseDraft()],
                  }))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add phase
                </button>
              </div>

              {form.phases.map((phase, index) => {
                const availableQuizzes = quizzes.filter(quiz =>
                  (!quiz.courseId || quiz.courseId === phase.courseId) &&
                  !form.phases.some(otherPhase =>
                    otherPhase.id !== phase.id &&
                    otherPhase.quizIds.includes(quiz.id),
                  ),
                );

                return (
                  <fieldset key={phase.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <legend className="text-sm font-semibold">Phase {index + 1}</legend>
                    {form.phases.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove phase ${index + 1}`}
                        onClick={() => setForm(current => ({
                          ...current,
                          phases: current.phases.filter(item => item.id !== phase.id),
                        }))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`phase-title-${phase.id}`} className="mb-1 block text-xs font-medium">Phase title</label>
                      <input
                        id={`phase-title-${phase.id}`}
                        value={phase.title}
                        onChange={event => updatePhase(phase.id, { title: event.target.value })}
                        required
                        maxLength={255}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm"
                        placeholder="e.g. Foundations"
                      />
                    </div>
                    <div>
                      <label htmlFor={`phase-course-${phase.id}`} className="mb-1 block text-xs font-medium">Course</label>
                      <select
                        id={`phase-course-${phase.id}`}
                        value={phase.courseId}
                        onChange={event => {
                          const courseId = event.target.value;
                          updatePhase(phase.id, {
                            courseId,
                            contentMode: 'course',
                            unitIds: [],
                            quizIds: [],
                          });
                          if (courseId) void loadCourseUnits(courseId);
                        }}
                        required
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm"
                      >
                        <option value="">Select a published course</option>
                        {publishedCourses.map(course => (
                          <option key={course.id} value={course.id}>
                            {course.title || course.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <fieldset className="sm:col-span-2">
                      <legend className="mb-1 block text-xs font-medium">Course content</legend>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`phase-content-${phase.id}`}
                            value="course"
                            checked={phase.contentMode === 'course'}
                            onChange={() => updatePhase(phase.id, { contentMode: 'course' })}
                          />
                          Whole course
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            name={`phase-content-${phase.id}`}
                            value="units"
                            checked={phase.contentMode === 'units'}
                            disabled={!phase.courseId}
                            onChange={() => {
                              updatePhase(phase.id, { contentMode: 'units' });
                              void loadCourseUnits(phase.courseId);
                            }}
                          />
                          Selected units only
                        </label>
                      </div>
                      {phase.contentMode === 'units' && (
                        <div className="mt-3 rounded-lg border border-border p-3">
                          {loadingUnitsForCourse.has(phase.courseId) ? (
                            <p role="status" className="text-sm text-muted-foreground">Loading course units…</p>
                          ) : unitLoadErrors[phase.courseId] ? (
                            <div>
                              <p role="alert" className="text-sm text-destructive">{unitLoadErrors[phase.courseId]}</p>
                              <button
                                type="button"
                                onClick={() => void loadCourseUnits(phase.courseId)}
                                className="mt-2 text-sm font-medium text-primary hover:underline"
                              >
                                Try again
                              </button>
                            </div>
                          ) : (unitsByCourseId[phase.courseId] || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              This course has no published units available to add.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Choose the units learners should complete in this phase.
                              </p>
                              {(unitsByCourseId[phase.courseId] || []).map(unit => (
                                <label key={unit.id} className="flex items-start gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={phase.unitIds.includes(unit.id)}
                                    onChange={() => togglePhaseUnit(phase, unit.id)}
                                    className="mt-0.5"
                                  />
                                  <span>{unit.title || unit.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </fieldset>
                    <fieldset className="sm:col-span-2">
                      <legend className="mb-1 block text-xs font-medium">
                        Checkpoint quizzes <span className="font-normal text-muted-foreground">(optional)</span>
                      </legend>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Add one or more quizzes to this phase. They follow its course or selected units, and required quizzes must be passed to count toward path completion.
                      </p>
                      {quizzesLoading ? (
                        <p role="status" className="text-sm text-muted-foreground">Loading published quizzes…</p>
                      ) : quizzesError ? (
                        <p role="alert" className="text-sm text-destructive">{quizzesError}</p>
                      ) : !phase.courseId ? (
                        <p className="text-sm text-muted-foreground">Select a course to choose relevant quizzes.</p>
                      ) : availableQuizzes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No other published quizzes are available for this phase.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {availableQuizzes.map(quiz => (
                            <label
                              key={quiz.id}
                              className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={phase.quizIds.includes(quiz.id)}
                                onChange={() => updatePhase(phase.id, {
                                  quizIds: phase.quizIds.includes(quiz.id)
                                    ? phase.quizIds.filter(id => id !== quiz.id)
                                    : [...phase.quizIds, quiz.id],
                                })}
                                className="mt-0.5"
                              />
                              <span>
                                <span className="block font-medium">{quiz.title}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {quiz.questionCount} questions
                                  {quiz.timeLimitMinutes
                                    ? ` · ${quiz.timeLimitMinutes} min`
                                    : ''}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                    <div className="sm:col-span-2">
                      <label htmlFor={`phase-description-${phase.id}`} className="mb-1 block text-xs font-medium">
                        Phase description <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <textarea
                        id={`phase-description-${phase.id}`}
                        value={phase.description}
                        onChange={event => updatePhase(phase.id, { description: event.target.value })}
                        rows={2}
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                        placeholder="What should learners focus on in this phase?"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor={`phase-milestone-${phase.id}`} className="mb-1 block text-xs font-medium">
                        Checkpoint <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        id={`phase-milestone-${phase.id}`}
                        value={phase.milestone}
                        onChange={event => updatePhase(phase.id, { milestone: event.target.value })}
                        maxLength={255}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm"
                        placeholder="e.g. Complete a medication-safety review"
                      />
                    </div>
                  </div>
                </fieldset>
                );
              })}
            </div>

            {pathFormError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {pathFormError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle aria-hidden="true" className="h-4 w-4" />
              {isSaving ? 'Saving draft…' : 'Save as draft'}
            </button>
            <p className="text-xs text-muted-foreground">
              Learner goals and flashcards remain personal study tools; path objectives and checkpoints are included here.
            </p>
          </form>
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Your learning paths</h2>
              <p className="mt-1 text-xs text-muted-foreground">Drafts can be published when ready.</p>
            </div>
            <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />
          </div>

          {pathListError && (
            <div role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {pathListError}
              <button type="button" onClick={() => void loadPaths()} className="ml-2 font-semibold underline">
                Retry
              </button>
            </div>
          )}

          {pathListLoading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading your learning paths…</p>
          ) : paths.length > 0 ? (
            <ul className="space-y-3">
              {paths.map(path => (
                <li key={path.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{path.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{path.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                      path.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    }`}>
                      {path.status}
                    </span>
                  </div>
                  {path.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => void publishPath(path.id)}
                      disabled={publishingPathId !== null}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {publishingPathId === path.id ? (
                        <Clock3 aria-hidden="true" className="h-4 w-4 animate-pulse" />
                      ) : (
                        <BookOpen aria-hidden="true" className="h-4 w-4" />
                      )}
                      {publishingPathId === path.id ? 'Publishing…' : 'Publish'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Your saved paths will appear here.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
