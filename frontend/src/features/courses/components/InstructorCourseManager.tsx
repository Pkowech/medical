'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, PlusCircle, Upload } from 'lucide-react';
import { courseService } from '@/features/courses/services/courseService';
import { unitService, Unit } from '@/features/courses/services/unitService';
import { topicService, Topic } from '@/features/courses/services/topicService';
import { Course } from '@/shared/types/courseInterface';
import { CourseForm } from '@/features/courses/components/CourseForm';
import { UnitForm } from '@/features/courses/components/UnitForm';
import { TopicForm } from '@/features/courses/components/TopicForm';
import { AdminCourseList } from '@/features/courses/components/AdminCourseList';
import { Button } from '@/shared/components/ui/button';

type FormMode = 'none' | 'course' | 'unit' | 'topic';

interface FormContext {
  mode: FormMode;
  course?: Course;
  unit?: Unit;
  topic?: Topic;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
};

export function InstructorCourseManager({ instructorId }: { instructorId: string }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourseIds, setLoadingCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formContext, setFormContext] = useState<FormContext>({ mode: 'none' });

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await courseService.getCourses({
        page: 1,
        limit: 100,
        instructorId,
      });
      setCourses(result.items || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, 'Failed to load your courses.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCourses();
  }, [instructorId]);

  useEffect(() => {
    if (!successMessage && !error) return;
    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
      setError(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage, error]);

  const loadCourseDetails = async (courseId: string) => {
    const course = courses.find(item => item.id === courseId);
    if (course?.units !== undefined || loadingCourseIds.has(courseId)) return;

    setLoadingCourseIds(current => new Set(current).add(courseId));
    try {
      const detailedCourse = await courseService.getCourseById(courseId);
      setCourses(current => current.map(item => item.id === courseId ? detailedCourse : item));
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Failed to load course units and topics.'));
    } finally {
      setLoadingCourseIds(current => {
        const next = new Set(current);
        next.delete(courseId);
        return next;
      });
    }
  };

  const handleSaveCourse = async (courseData: Partial<Course>) => {
    try {
      if (formContext.course?.id) {
        const updatedCourse = await courseService.updateCourse(formContext.course.id, courseData);
        setCourses(current => current.map(course => course.id === updatedCourse.id ? updatedCourse : course));
        setSuccessMessage('Course updated successfully.');
      } else {
        const newCourse = await courseService.createCourse(courseData);
        setCourses(current => [newCourse, ...current]);
        setSuccessMessage('Course created successfully.');
      }
      setFormContext({ mode: 'none' });
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save course.'));
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!confirm(`Delete "${course.title}" and all of its units and topics?`)) return;
    try {
      await courseService.deleteCourse(course.id);
      setCourses(current => current.filter(item => item.id !== course.id));
      setSuccessMessage('Course deleted successfully.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Failed to delete course.'));
    }
  };

  const handleSaveUnit = async (unitData: Partial<Unit>) => {
    const course = formContext.course;
    if (!course) return;
    try {
      if (formContext.unit?.id) {
        const updatedUnit = await unitService.updateUnit(formContext.unit.id, unitData);
        setCourses(current => current.map(item => item.id === course.id
          ? { ...item, units: item.units?.map(unit => unit.id === updatedUnit.id ? updatedUnit : unit) }
          : item));
        setSuccessMessage('Unit updated successfully.');
      } else {
        const newUnit = await unitService.createUnit(course.id, unitData);
        setCourses(current => current.map(item => item.id === course.id
          ? { ...item, units: [...(item.units || []), newUnit] }
          : item));
        setSuccessMessage('Unit created successfully.');
      }
      setFormContext({ mode: 'none' });
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save unit.'));
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(`Delete "${unit.title}" and its topics?`)) return;
    try {
      await unitService.deleteUnit(unit.id);
      setCourses(current => current.map(course => ({
        ...course,
        units: course.units?.filter(item => item.id !== unit.id),
      })));
      setSuccessMessage('Unit deleted successfully.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Failed to delete unit.'));
    }
  };

  const handleSaveTopic = async (topicData: Partial<Topic>) => {
    const unit = formContext.unit;
    if (!unit) return;
    try {
      if (formContext.topic?.id) {
        const updatedTopic = await topicService.updateTopic(formContext.topic.id, topicData);
        setCourses(current => current.map(course => ({
          ...course,
          units: course.units?.map(item => item.id === unit.id
            ? { ...item, topics: item.topics?.map(topic => topic.id === updatedTopic.id ? updatedTopic : topic) }
            : item),
        })));
        setSuccessMessage('Topic updated successfully.');
      } else {
        const newTopic = await topicService.createTopic(unit.id, topicData);
        setCourses(current => current.map(course => ({
          ...course,
          units: course.units?.map(item => item.id === unit.id
            ? { ...item, topics: [...(item.topics || []), newTopic] }
            : item),
        })));
        setSuccessMessage('Topic created successfully.');
      }
      setFormContext({ mode: 'none' });
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Failed to save topic.'));
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    if (!confirm(`Delete "${topic.title || topic.name || 'this topic'}"?`)) return;
    try {
      await topicService.deleteTopic(topic.id);
      setCourses(current => current.map(course => ({
        ...course,
        units: course.units?.map(unit => ({
          ...unit,
          topics: unit.topics?.filter(item => item.id !== topic.id),
        })),
      })));
      setSuccessMessage('Topic deleted successfully.');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Failed to delete topic.'));
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading your courses...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm font-medium text-primary">Instructor workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Course management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your courses, units, and topics.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/study-planner/materials/upload')}>
            <Upload className="mr-2 h-4 w-4" /> Upload material
          </Button>
          <Button onClick={() => setFormContext({ mode: 'course' })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create course
          </Button>
        </div>
      </div>

      {successMessage && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{successMessage}</div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {formContext.mode === 'course' && (
        <CourseForm course={formContext.course || null} onSave={handleSaveCourse} onCancel={() => setFormContext({ mode: 'none' })} />
      )}
      {formContext.mode === 'unit' && formContext.course && (
        <UnitForm unit={formContext.unit || null} courseId={formContext.course.id} onSave={handleSaveUnit} onCancel={() => setFormContext({ mode: 'none' })} />
      )}
      {formContext.mode === 'topic' && formContext.unit && (
        <TopicForm topic={formContext.topic || null} unitId={formContext.unit.id} onSave={handleSaveTopic} onCancel={() => setFormContext({ mode: 'none' })} />
      )}

      {formContext.mode === 'none' && (
        <AdminCourseList
          courses={courses}
          loadingCourseIds={loadingCourseIds}
          onExpandCourse={loadCourseDetails}
          onEdit={course => setFormContext({ mode: 'course', course })}
          onDelete={handleDeleteCourse}
          canDeleteCourse={false}
          onAddUnit={course => setFormContext({ mode: 'unit', course })}
          onEditUnit={(unit, courseId) => {
            const course = courses.find(item => item.id === courseId);
            if (course) setFormContext({ mode: 'unit', course, unit });
          }}
          onDeleteUnit={handleDeleteUnit}
          onAddTopic={(unit, courseId) => {
            const course = courses.find(item => item.id === courseId);
            if (course) setFormContext({ mode: 'topic', course, unit });
          }}
          onEditTopic={(topic, unitId) => {
            const unit = courses.flatMap(course => course.units || []).find(item => item.id === unitId);
            if (unit) setFormContext({ mode: 'topic', unit, topic });
          }}
          onDeleteTopic={handleDeleteTopic}
        />
      )}
    </div>
  );
}