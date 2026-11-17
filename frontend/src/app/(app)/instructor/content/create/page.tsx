'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Check, ChevronRight, ClipboardList, Layers3 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { Role } from '@/shared/enums/role.enum';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { CourseForm } from '@/features/courses/components/CourseForm';
import { TopicForm } from '@/features/courses/components/TopicForm';
import { UnitForm } from '@/features/courses/components/UnitForm';
import { courseService } from '@/features/courses/services/courseService';
import { topicService, type Topic } from '@/features/courses/services/topicService';
import { unitService, type Unit } from '@/features/courses/services/unitService';
import type { Course, CourseUnit } from '@/shared/types/courseInterface';

const NO_SELECTION = 'none';

const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

const steps = [
  { number: 1, title: 'Course', description: 'Choose or create a course', icon: BookOpen },
  { number: 2, title: 'Unit', description: 'Choose or create a unit', icon: Layers3 },
  { number: 3, title: 'Topic', description: 'Add a topic, assessment, and materials', icon: ClipboardList },
];

export default function InstructorContentBuilderPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <InstructorContentBuilder />
    </Suspense>
  );
}

function InstructorContentBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const canManageContent = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);
  const initialCourseId = searchParams.get('courseId');
  const initialUnitId = searchParams.get('unitId');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(NO_SELECTION);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState(NO_SELECTION);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const courseTitle = selectedCourse?.title || selectedCourse?.name || 'Selected course';
  const unitTitle = selectedUnit?.title || selectedUnit?.name || 'Selected unit';
  const availableUnits = useMemo(() => selectedCourse?.units ?? [], [selectedCourse]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!canManageContent) router.replace('/unauthorized');
  }, [canManageContent, isAuthenticated, isLoading, router]);

  useEffect(() => {
    setHeader({
      title: 'Course content builder',
      description: 'Create a course structure and add optional learning resources and assessments.',
      actions: (
        <Button asChild size="sm" variant="outline">
          <Link href="/instructor/content">Course management</Link>
        </Button>
      ),
    });
    return () => setHeader(null);
  }, [setHeader]);

  useEffect(() => {
    if (!user?.id || !canManageContent) return;
    let active = true;

    const loadCourses = async () => {
      setLoadingCourses(true);
      setPageError(null);
      try {
        const result = await courseService.getCourses({
          page: 1,
          limit: 100,
          instructorId: user.id,
        });
        if (!active) return;
        setCourses(result.items ?? []);

        if (initialCourseId) {
          setSelectedCourseId(initialCourseId);
          setLoadingCourseDetails(true);
          const course = await courseService.getCourseById(initialCourseId);
          if (!active) return;
          setSelectedCourse(course);
          if (initialUnitId) {
            const unit = course.units?.find(item => item.id === initialUnitId);
            if (!unit) {
              setPageError('The selected unit could not be found in this course.');
              setCurrentStep(2);
            } else {
              setSelectedUnit(unit);
              setSelectedUnitId(unit.id);
              setCurrentStep(3);
            }
          } else {
            setCurrentStep(2);
          }
        }
      } catch (cause) {
        if (active) {
          console.error('Failed to load courses for the content builder', cause);
          setPageError(errorMessage(cause, 'Your courses could not be loaded.'));
        }
      } finally {
        if (active) {
          setLoadingCourses(false);
          setLoadingCourseDetails(false);
        }
      }
    };

    void loadCourses();
    return () => {
      active = false;
    };
  }, [canManageContent, initialCourseId, initialUnitId, user?.id]);

  const loadSelectedCourse = async () => {
    if (selectedCourseId === NO_SELECTION) return;
    setLoadingCourseDetails(true);
    setPageError(null);
    setSuccessMessage(null);
    try {
      const course = await courseService.getCourseById(selectedCourseId);
      setSelectedCourse(course);
      setSelectedUnit(null);
      setSelectedUnitId(NO_SELECTION);
      setSelectedTopic(null);
      setCurrentStep(2);
    } catch (cause) {
      console.error('Failed to load the selected course curriculum', cause);
      setPageError(errorMessage(cause, 'The selected course could not be loaded.'));
    } finally {
      setLoadingCourseDetails(false);
    }
  };

  const createCourse = async (courseData: Partial<Course>) => {
    setPageError(null);
    setSuccessMessage(null);
    try {
      const course = await courseService.createCourse(courseData);
      const courseWithUnits = { ...course, units: course.units ?? [] };
      setCourses(current => [courseWithUnits, ...current.filter(item => item.id !== course.id)]);
      setSelectedCourse(courseWithUnits);
      setSelectedCourseId(course.id);
      setShowCourseForm(false);
      setCurrentStep(2);
      setSuccessMessage('Course created. Now choose or add a unit.');
    } catch (cause) {
      console.error('Failed to create a course in the content builder', cause);
      setPageError(errorMessage(cause, 'The course could not be created.'));
    }
  };

  const createUnit = async (unitData: Partial<Unit>) => {
    if (!selectedCourse) return;
    setPageError(null);
    setSuccessMessage(null);
    try {
      const unit = await unitService.createUnit(selectedCourse.id, unitData);
      const updatedCourse = {
        ...selectedCourse,
        units: [...(selectedCourse.units ?? []), unit],
      };
      setSelectedCourse(updatedCourse);
      setSelectedUnit(unit);
      setSelectedUnitId(unit.id);
      setShowUnitForm(false);
      setCurrentStep(3);
      setSuccessMessage('Unit created. Now add a topic.');
    } catch (cause) {
      console.error('Failed to create a unit in the content builder', cause);
      setPageError(errorMessage(cause, 'The unit could not be created.'));
      throw cause;
    }
  };

  const continueWithSelectedUnit = () => {
    const unit = availableUnits.find(item => item.id === selectedUnitId);
    if (!unit) {
      setPageError('Select a unit before continuing.');
      return;
    }
    setPageError(null);
    setSelectedUnit(unit);
    setSelectedTopic(null);
    setCurrentStep(3);
  };

  const saveTopic = async (topicData: Partial<Topic>): Promise<Topic> => {
    if (!selectedUnit) throw new Error('Choose a unit before saving a topic.');
    setPageError(null);
    setSuccessMessage(null);

    const savedTopic = selectedTopic?.id
      ? await topicService.updateTopic(selectedTopic.id, topicData)
      : await topicService.createTopic(selectedUnit.id, topicData);

    const updateUnit = (unit: CourseUnit): CourseUnit => ({
      ...unit,
      topics: selectedTopic?.id
        ? (unit.topics ?? []).map(topic => topic.id === savedTopic.id ? savedTopic : topic)
        : [...(unit.topics ?? []), savedTopic],
    });
    const updatedUnit = updateUnit(selectedUnit);
    setSelectedUnit(updatedUnit);
    setSelectedCourse(current => current
      ? {
          ...current,
          units: (current.units ?? []).map(unit => unit.id === updatedUnit.id ? updatedUnit : unit),
        }
      : current);
    setSelectedTopic(savedTopic);
    setSuccessMessage(
      selectedTopic?.id
        ? 'Topic details saved. You can update its assessment or materials below.'
        : 'Topic created. You can now add its assessment or materials below.',
    );
    return savedTopic;
  };

  if (isLoading || !isAuthenticated || !canManageContent || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-1">
      <section className="space-y-2">
        <p className="text-sm font-medium text-primary">Instructor workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">Build course content</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Create or choose a course, add a unit, then create a topic. Topic assessments and learning
          materials are optional and can be added after the topic is saved.
        </p>
      </section>

      <ol aria-label="Course content creation steps" className="grid gap-3 md:grid-cols-3">
        {steps.map(({ number, title, description, icon: Icon }) => {
          const isComplete = currentStep > number;
          const isCurrent = currentStep === number;
          return (
            <li
              key={number}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-sm font-semibold">{number}. {title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {pageError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {pageError}
        </p>
      )}
      {successMessage && (
        <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
          {successMessage}
        </p>
      )}

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a course</CardTitle>
            <CardDescription>
              Start with an existing course or create a new course before adding units and topics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCourses ? (
              <p role="status" className="text-sm text-muted-foreground">Loading your courses...</p>
            ) : courses.length > 0 ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="builder-course" className="text-sm font-medium">Existing course</label>
                  <Select
                    value={selectedCourseId}
                    onValueChange={value => {
                      setSelectedCourseId(value);
                      setShowCourseForm(false);
                      setPageError(null);
                    }}
                  >
                    <SelectTrigger id="builder-course">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SELECTION}>Select a course</SelectItem>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title || course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void loadSelectedCourse()}
                    disabled={selectedCourseId === NO_SELECTION || loadingCourseDetails}
                  >
                    {loadingCourseDetails ? 'Loading course...' : 'Continue with course'}
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCourseForm(true);
                      setPageError(null);
                    }}
                  >
                    Create a new course
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground">You do not have a course yet. Create one to begin building its content.</p>
                <Button className="mt-3" type="button" onClick={() => setShowCourseForm(true)}>
                  Create your first course
                </Button>
              </div>
            )}
            {showCourseForm && (
              <CourseForm
                course={null}
                onSave={createCourse}
                onCancel={() => setShowCourseForm(false)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && selectedCourse && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a unit</CardTitle>
            <CardDescription>Select a unit in this course or create a new one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</p>
                <p className="text-sm font-semibold">{courseTitle}</p>
              </div>
            </div>
            {availableUnits.length > 0 && (
              <div className="space-y-2">
                <label htmlFor="builder-unit" className="text-sm font-medium">Existing unit</label>
                <Select
                  value={selectedUnitId}
                  onValueChange={value => {
                    setSelectedUnitId(value);
                    setPageError(null);
                  }}
                >
                  <SelectTrigger id="builder-unit">
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>Select a unit</SelectItem>
                    {availableUnits.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.title || unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!showUnitForm && (
              <div className="flex flex-wrap gap-2">
                {availableUnits.length > 0 && (
                  <Button type="button" onClick={continueWithSelectedUnit} disabled={selectedUnitId === NO_SELECTION}>
                    Continue with unit
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setShowUnitForm(true)}>
                  {availableUnits.length > 0 ? 'Create a new unit' : 'Create the first unit'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)}>
                  Change course
                </Button>
              </div>
            )}
            {showUnitForm && (
              <UnitForm
                unit={null}
                courseId={selectedCourse.id}
                courseTitle={courseTitle}
                onSave={createUnit}
                onCancel={() => setShowUnitForm(false)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && selectedCourse && selectedUnit && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Topic placement</p>
              <p className="mt-1 text-sm font-semibold">
                {courseTitle}
                <ChevronRight className="mx-1 inline h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {unitTitle}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
                Change unit
              </Button>
              {selectedTopic && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setSelectedTopic(null);
                    setSuccessMessage(null);
                    setPageError(null);
                  }}
                >
                  Add another topic
                </Button>
              )}
            </div>
          </div>
          <TopicForm
            topic={selectedTopic}
            courseId={selectedCourse.id}
            courseTitle={courseTitle}
            unitId={selectedUnit.id}
            unitTitle={unitTitle}
            onSave={saveTopic}
            onCancel={() => router.push('/instructor/content')}
            cancelLabel="Return to courses"
          />
        </section>
      )}

      <div className="flex justify-start">
        <Button asChild variant="ghost">
          <Link href="/instructor/content">Exit content builder</Link>
        </Button>
      </div>
    </div>
  );
}
