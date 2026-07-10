// frontend/src/app/(app)/admin/content/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { courseService } from '@/features/courses/services/courseService';
import { unitService, Unit } from '@/features/courses/services/unitService';
import { topicService, Topic } from '@/features/courses/services/topicService';
import { Course } from '@/shared/types/courseInterface';
import { CourseForm } from '@/features/courses/components/CourseForm';
import { UnitForm } from '@/features/courses/components/UnitForm';
import { TopicForm } from '@/features/courses/components/TopicForm';
import { AdminCourseList } from '@/features/courses/components/AdminCourseList';
import { Button } from '@/shared/components/ui/button';
import { PlusCircle, AlertCircle } from 'lucide-react';

type FormMode = 'none' | 'course' | 'unit' | 'topic';

interface FormContext {
  mode: FormMode;
  course?: Course;
  unit?: Unit;
  topic?: Topic;
}

export default function AdminContentPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formContext, setFormContext] = useState<FormContext>({ mode: 'none' });

  // Load all courses with their units and topics
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await courseService.getCourses({ page: 1, limit: 100 });
      setCourses(result.items || []);
    } catch (err) {
      setError('Failed to fetch courses.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Handle course creation/update
  const handleCreateOrUpdateCourse = async (courseData: Partial<Course>) => {
    try {
      let updatedCourse: Course;
      if (formContext.course?.id) {
        updatedCourse = await courseService.updateCourse(formContext.course.id, courseData);
        setCourses(courses.map(c => c.id === updatedCourse.id ? updatedCourse : c));
        setSuccessMessage('Course updated successfully');
      } else {
        updatedCourse = await courseService.createCourse(courseData);
        setCourses([...courses, updatedCourse]);
        setSuccessMessage('Course created successfully');
      }
      setFormContext({ mode: 'none' });
    } catch (err) {
      setError('Failed to save course');
      console.error(err);
    }
  };

  // Handle course deletion
  const handleDeleteCourse = async (course: Course) => {
    if (confirm(`Are you sure you want to delete "${course.title}"? This will also delete all associated units and topics.`)) {
      try {
        await courseService.deleteCourse(course.id);
        setCourses(courses.filter(c => c.id !== course.id));
        setSuccessMessage('Course deleted successfully');
      } catch (err) {
        setError('Failed to delete course');
        console.error(err);
      }
    }
  };

  // Handle unit creation/update
  const handleCreateOrUpdateUnit = async (unitData: Partial<Unit>) => {
    try {
      if (formContext.unit?.id) {
        const updatedUnit = await unitService.updateUnit(formContext.unit.id, unitData);
        setCourses(courses.map(c => {
          if (c.id === formContext.course?.id && c.units) {
            return {
              ...c,
              units: c.units.map(u => u.id === updatedUnit.id ? updatedUnit : u),
            };
          }
          return c;
        }));
        setSuccessMessage('Unit updated successfully');
      } else {
        const newUnit = await unitService.createUnit(formContext.course?.id || '', unitData);
        setCourses(courses.map(c => {
          if (c.id === formContext.course?.id) {
            return {
              ...c,
              units: [...(c.units || []), newUnit],
            };
          }
          return c;
        }));
        setSuccessMessage('Unit created successfully');
      }
      setFormContext({ mode: 'none' });
    } catch (err) {
      setError('Failed to save unit');
      console.error(err);
    }
  };

  // Handle unit deletion
  const handleDeleteUnit = async (unit: Unit) => {
    if (confirm(`Are you sure you want to delete "${unit.title}"? This will also delete all associated topics.`)) {
      try {
        await unitService.deleteUnit(unit.id);
        setCourses(courses.map(c => {
          if (c.units) {
            return {
              ...c,
              units: c.units.filter(u => u.id !== unit.id),
            };
          }
          return c;
        }));
        setSuccessMessage('Unit deleted successfully');
      } catch (err) {
        setError('Failed to delete unit');
        console.error(err);
      }
    }
  };

  // Handle topic creation/update
  const handleCreateOrUpdateTopic = async (topicData: Partial<Topic>) => {
    try {
      if (formContext.topic?.id) {
        const updatedTopic = await topicService.updateTopic(formContext.topic.id, topicData);
        setCourses(courses.map(c => {
          if (c.units) {
            return {
              ...c,
              units: c.units.map(u => {
                if (u.topics) {
                  return {
                    ...u,
                    topics: u.topics.map(t => t.id === updatedTopic.id ? updatedTopic : t),
                  };
                }
                return u;
              }),
            };
          }
          return c;
        }));
        setSuccessMessage('Topic updated successfully');
      } else {
        const newTopic = await topicService.createTopic(formContext.unit?.id || '', topicData);
        setCourses(courses.map(c => {
          if (c.units) {
            return {
              ...c,
              units: c.units.map(u => {
                if (u.id === formContext.unit?.id) {
                  return {
                    ...u,
                    topics: [...(u.topics || []), newTopic],
                  };
                }
                return u;
              }),
            };
          }
          return c;
        }));
        setSuccessMessage('Topic created successfully');
      }
      setFormContext({ mode: 'none' });
    } catch (err) {
      setError('Failed to save topic');
      console.error(err);
    }
  };

  // Handle topic deletion
  const handleDeleteTopic = async (topic: Topic) => {
    if (confirm(`Are you sure you want to delete "${topic.title}"?`)) {
      try {
        await topicService.deleteTopic(topic.id);
        setCourses(courses.map(c => {
          if (c.units) {
            return {
              ...c,
              units: c.units.map(u => {
                if (u.topics) {
                  return {
                    ...u,
                    topics: u.topics.filter(t => t.id !== topic.id),
                  };
                }
                return u;
              }),
            };
          }
          return c;
        }));
        setSuccessMessage('Topic deleted successfully');
      } catch (err) {
        setError('Failed to delete topic');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading Content Management...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Content Management</h1>
          <p className="text-gray-600 mt-1">Create and manage courses, units, and topics</p>
        </div>
        <Button
          onClick={() => setFormContext({ mode: 'course' })}
          className="gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Create Course
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-gap-2">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Forms */}
      {formContext.mode === 'course' && (
        <CourseForm
          course={formContext.course || null}
          onSave={handleCreateOrUpdateCourse}
          onCancel={() => setFormContext({ mode: 'none' })}
        />
      )}

      {formContext.mode === 'unit' && formContext.course && (
        <UnitForm
          unit={formContext.unit || null}
          courseId={formContext.course.id}
          onSave={handleCreateOrUpdateUnit}
          onCancel={() => setFormContext({ mode: 'none' })}
        />
      )}

      {formContext.mode === 'topic' && formContext.unit && (
        <TopicForm
          topic={formContext.topic || null}
          unitId={formContext.unit.id}
          onSave={handleCreateOrUpdateTopic}
          onCancel={() => setFormContext({ mode: 'none' })}
        />
      )}

      {/* Course List */}
      {formContext.mode === 'none' && (
        <AdminCourseList
          courses={courses}
          onEdit={(course) => setFormContext({ mode: 'course', course })}
          onDelete={handleDeleteCourse}
          onAddUnit={(course) => setFormContext({ mode: 'unit', course })}
          onEditUnit={(unit, courseId) => {
            const course = courses.find(c => c.id === courseId);
            if (course) {
              setFormContext({ mode: 'unit', course, unit });
            }
          }}
          onDeleteUnit={handleDeleteUnit}
          onAddTopic={(unit, courseId) => {
            const course = courses.find(c => c.id === courseId);
            if (course) {
              setFormContext({ mode: 'topic', course, unit });
            }
          }}
          onEditTopic={(topic, unitId) => {
            let selectedUnit = null;
            for (const course of courses) {
              const unit = course.units?.find(u => u.id === unitId);
              if (unit) {
                selectedUnit = unit;
                break;
              }
            }
            if (selectedUnit) {
              setFormContext({ mode: 'topic', unit: selectedUnit, topic });
            }
          }}
          onDeleteTopic={handleDeleteTopic}
        />
      )}
    </div>
  );
}
