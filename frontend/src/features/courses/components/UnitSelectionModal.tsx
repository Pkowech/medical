import React, { useState } from 'react';
import { 
  Info, 
  AlertCircle, 
  X,
  LayoutGrid,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { courseService } from '../services/courseService';
import { Course } from '@/shared/types/courseInterface';

interface UnitSelectionModalProps {
  course: Course;
  activeUnitIds?: string[];
  onClose: () => void;
  onComplete: () => void;
}

export const UnitSelectionModal = ({ course, activeUnitIds = [], onClose, onComplete }: UnitSelectionModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activatingUnitId, setActivatingUnitId] = useState<string | null>(null);

  const MAX_CONCURRENT = 4;
  const activeUnitSet = new Set(activeUnitIds);

  const handleActivate = async (unitId: string) => {
    setIsSubmitting(true);
    setActivatingUnitId(unitId);
    setError(null);
    try {
      try {
        const enrollments = await courseService.getEnrolledCourses({
          status: 'active',
          page: 1,
          limit: 100,
        });
        const isCourseEnrolled = (enrollments.items || []).some(
          enrollment => enrollment.courseId === course.id,
        );
        if (!isCourseEnrolled) await courseService.enrollInCourse(course.id);
      } catch (enrollmentError) {
        const errorMessage = enrollmentError instanceof Error ? enrollmentError.message : String(enrollmentError);
        if (!errorMessage.toLowerCase().includes('already enrolled')) throw enrollmentError;
      }

      const result = await courseService.activateUnit(unitId, MAX_CONCURRENT);
      if (!result.success) throw new Error(result.message || 'Could not activate this unit.');
      onComplete();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
      setError(message || 'Failed to activate this unit. Check the concurrent unit limit.');
    } finally {
      setIsSubmitting(false);
      setActivatingUnitId(null);
    }
  };

  const units = course.units || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-blue-500" />
              Initialize Your Learning Plan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Course: <span className="font-medium text-slate-700 dark:text-slate-200">{course.title || course.name}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            title="Close modal"
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Study Slots & Concurrent Limits</p>
              <p>Choose one or more units to start. You can have up to <strong>{MAX_CONCURRENT}</strong> units active across all courses. Currently using <strong>{activeUnitIds.length}</strong> slots.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Available Units</h3>
            {units.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No units available for this course.</p>
            ) : (
              <div className="grid gap-3">
                {units.map((unit) => {
                  const isActive = activeUnitSet.has(unit.id);
                  return (
                    <div
                      key={unit.id}
                      className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/10'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-sm ${isActive ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-200'}`}>
                            {unit.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1">
                            {unit.description || 'Comprehensive learning module'}
                          </p>
                        </div>
                      </div>
                      {isActive ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleActivate(unit.id)}
                          disabled={isSubmitting}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          {activatingUnitId === unit.id ? 'Starting...' : 'Start unit'}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded-lg border border-red-100 dark:border-red-800/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
