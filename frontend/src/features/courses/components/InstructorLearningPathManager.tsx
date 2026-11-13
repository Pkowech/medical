'use client';

import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle, Clock3, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAssessments, type Assessment } from '@/features/assessment/services/assessmentService';
import type { Course } from '@/shared/types/courseInterface';
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
  assessmentId: string;
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
  assessmentId: '',
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
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentsError, setAssessmentsError] = useState('');
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [pathListLoading, setPathListLoading] = useState(true);
  const [pathListError, setPathListError] = useState('');
  const [pathFormError, setPathFormError] = useState('');
  const [form, setForm] = useState(createEmptyPath);
  const [isSaving, setIsSaving] = useState(false);
  const [publishingPathId, setPublishingPathId] = useState<string | null>(null);

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
        if (active) setAssessments(items);
      })
      .catch(error => {
        console.error('Failed to load published assessments for path builder:', error);
        if (active) {
          setAssessmentsError(getErrorMessage(error, 'Published assessments could not be loaded.'));
        }
      })
      .finally(() => {
        if (active) setAssessmentsLoading(false);
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
    if (form.phases.some(phase => !phase.title.trim() || !phase.courseId)) {
      setPathFormError('Give every phase a title and select a published course.');
      return null;
    }
    if (
      form.phases.some(phase =>
        phase.assessmentId &&
        !assessments.some(assessment =>
          assessment.id === phase.assessmentId &&
          (!assessment.courseId || assessment.courseId === phase.courseId),
        ),
      )
    ) {
      setPathFormError('A selected assessment is not available for its course. Choose another assessment.');
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
          const modules: CreateLearningPathPayload['pathStructure']['phases'][number]['modules'] = [
            courseModule,
          ];
          const assessment = assessments.find(item => item.id === phase.assessmentId);
          if (assessment) {
            modules.push({
              id: crypto.randomUUID(),
              type: 'assessment',
              resourceId: assessment.id,
              title: assessment.title,
              description: assessment.description,
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
            Organize your published courses into phases, set learning objectives, and add checkpoints.
          </p>
        </div>

        {publishedCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
            <p className="font-medium text-foreground">Publish a course first</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A path contains courses, including their units and topics. Only your published courses can be added.
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
                    Add a course and its units/topics, plus an optional published assessment and checkpoint.
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

              {form.phases.map((phase, index) => (
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
                        onChange={event => updatePhase(phase.id, {
                          courseId: event.target.value,
                          assessmentId: '',
                        })}
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
                    <div>
                      <label htmlFor={`phase-assessment-${phase.id}`} className="mb-1 block text-xs font-medium">
                        Assessment <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <select
                        id={`phase-assessment-${phase.id}`}
                        value={phase.assessmentId}
                        onChange={event => updatePhase(phase.id, { assessmentId: event.target.value })}
                        disabled={!phase.courseId || assessmentsLoading || Boolean(assessmentsError)}
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-60"
                      >
                        <option value="">
                          {assessmentsLoading
                            ? 'Loading assessments…'
                            : assessmentsError
                              ? 'Assessments unavailable'
                              : 'No assessment'}
                        </option>
                        {assessments
                          .filter(assessment =>
                            !assessment.courseId || assessment.courseId === phase.courseId,
                          )
                          .map(assessment => (
                            <option key={assessment.id} value={assessment.id}>
                              {assessment.title}
                            </option>
                          ))}
                      </select>
                      {assessmentsError && (
                        <p className="mt-1 text-xs text-destructive">{assessmentsError}</p>
                      )}
                    </div>
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
              ))}
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
