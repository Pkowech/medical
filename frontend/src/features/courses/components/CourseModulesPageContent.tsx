import React from 'react';
import { useParams } from 'next/navigation';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { SEO } from '@/shared/components/layout/SEO';
import { BookOpen, Clock, CheckCircle } from 'lucide-react';
import { useCourseModules } from '@/features/courses/hooks/useCourseModules';

export function CourseModulesPageContent() {
  const { courseId } = useParams();
  const { modules, courseTitle, isLoading, error } = useCourseModules(courseId as string);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Error Loading Modules</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-5">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <SEO title={`${courseTitle} - Modules`} description={`Course modules for ${courseTitle}`} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {courseTitle} - Modules
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Complete all modules to finish the course
          </p>
        </div>

        <div className="space-y-4">
          {modules.map(module => (
            <div
              key={module.id}
              className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {module.isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-indigo-500" />
                    )}
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {module.title}
                    </h3>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-1" />
                    {module.duration}
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {module.description}
                </p>

                <div className="mt-6">
                  <button
                    className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      module.isCompleted
                        ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                  >
                    {module.isCompleted ? 'Review Module' : 'Start Module'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppErrorBoundary>
  );
}

/*
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { apiService } from '@/features/auth/services/apiClient';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { SEO } from '@/shared/components/SEO';
import { BookOpen, Clock, CheckCircle, Lock } from 'lucide-react';
import { Course, CourseModule, Lesson } from '@/shared/types/courseInterface';

interface Module {
  id: string;
  title: string;
  description: string;
  duration: number;
  order: number;
  isCompleted?: boolean;
  lessons: Lesson[];
}

export function CourseModulesPageContent() {
  const { courseId } = useParams();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [courseTitle, setCourseTitle] = useState('');

  useEffect(() => {
    const fetchCourseModules = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [courseResponse, modulesResponse] = await Promise.all([
          apiService.get<Course>(`/courses/${courseId}`),
          apiService.get<CourseModule[]>(`/courses/${courseId}/modules`),
        ]);
        setCourseTitle(courseResponse.data.title);
        setModules(modulesResponse.data);
      } catch (err: unknown) {
        // Keep message generic for UI; internal logging can capture details
        console.error('CourseModulesPageContent: fetch error', err);
        setError('Failed to load course modules');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseModules();
  }, [courseId]);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Error Loading Modules</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-5">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <SEO title={`${courseTitle} - Modules`} description={`Course modules for ${courseTitle}`} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {courseTitle} - Modules
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Complete all modules to finish the course
          </p>
        </div>

        <div className="space-y-4">
          {modules.map(module => (
            <div
              key={module.id}
              className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {module.isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-indigo-500" />
                    )}
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {module.title}
                    </h3>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4 mr-1" />
                    {module.duration}
                  </div>
                </div>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {module.description}
                </p>

                <div className="mt-6">
                  <button
                    className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      module.isCompleted
                        ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                  >
                    {module.isCompleted
                      ? 'Review Module'
                      : 'Start Module'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
  </AppErrorBoundary>
  );
}

*/
