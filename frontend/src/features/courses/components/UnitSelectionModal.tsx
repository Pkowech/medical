import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Info, 
  AlertCircle, 
  X,
  LayoutGrid,
  ChevronRight,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { courseService, MAX_ACTIVE_UNITS } from '../services/courseService';
import { Course } from '@/shared/types/courseInterface';

interface UnitSelectionModalProps {
  course: Course;
  activeUnitIds?: string[];
  completedUnitIds?: string[];
  onClose: () => void;
  onComplete: (action: 'activated' | 'deactivated') => void;
}

export const UnitSelectionModal = ({
  course,
  activeUnitIds = [],
  completedUnitIds = [],
  onClose,
  onComplete,
}: UnitSelectionModalProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activatingUnitId, setActivatingUnitId] = useState<string | null>(null);
  const [deactivatingUnitId, setDeactivatingUnitId] = useState<string | null>(null);

  const completedUnitSet = new Set(completedUnitIds);
  const activeUnitSet = new Set(activeUnitIds.filter(id => !completedUnitSet.has(id)));
  const activeUnitCount = activeUnitSet.size;
  const relatedUnits = useQuery({
    queryKey: ['related-unit-recommendations', [...activeUnitSet].sort()],
    queryFn: () => courseService.getRelatedUnitRecommendations(),
    enabled: activeUnitCount > 0,
    staleTime: 5 * 60 * 1000,
  });

  const handleActivate = async (unitId: string, courseId = course.id) => {
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
          enrollment => enrollment.courseId === courseId,
        );
        if (!isCourseEnrolled) await courseService.enrollInCourse(courseId);
      } catch (enrollmentError) {
        const errorMessage = enrollmentError instanceof Error ? enrollmentError.message : String(enrollmentError);
        if (!errorMessage.toLowerCase().includes('already enrolled')) throw enrollmentError;
      }

      const result = await courseService.activateUnit(unitId);
      if (!result.success) throw new Error(result.message || 'Could not activate this unit.');
      onComplete('activated');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
      setError(message || 'Failed to activate this unit.');
    } finally {
      setIsSubmitting(false);
      setActivatingUnitId(null);
    }
  };

  const handleDeactivate = async (unitId: string, title: string) => {
    if (!window.confirm(`Remove ${title} from your active units? Your progress will be kept.`)) {
      return;
    }

    setIsSubmitting(true);
    setDeactivatingUnitId(unitId);
    setError(null);
    try {
      await courseService.deactivateUnit(unitId);
      onComplete('deactivated');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : String(err));
      setError(message || 'Could not remove this unit from your active units.');
    } finally {
      setIsSubmitting(false);
      setDeactivatingUnitId(null);
    }
  };

  const units = course.units || [];
  const relatedToOtherCourses = (relatedUnits.data || []).filter(
    recommendation => recommendation.courseId !== course.id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-blue-500" />
              Manage your units
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
              <p className="font-semibold mb-1">Active units</p>
              <p>You can keep up to <strong>{MAX_ACTIVE_UNITS}</strong> units active across your courses. You currently have <strong>{activeUnitCount}</strong> active.</p>
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
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Active</span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeactivate(
                                unit.id,
                                unit.title || unit.name || 'this unit',
                              )
                            }
                            disabled={isSubmitting}
                            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {deactivatingUnitId === unit.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      ) : completedUnitSet.has(unit.id) ? (
                        <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Completed</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleActivate(unit.id)}
                          disabled={isSubmitting || activeUnitCount >= MAX_ACTIVE_UNITS}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {activatingUnitId === unit.id
                            ? 'Starting...'
                            : activeUnitCount >= MAX_ACTIVE_UNITS
                              ? 'Limit reached'
                              : 'Start unit'}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {activeUnitCount > 0 && (
            <section className="mt-8 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Related units to explore
                </h3>
              </div>
              {relatedUnits.isLoading ? (
                <p className="text-sm text-slate-500" role="status">Finding units related to your active learning…</p>
              ) : relatedUnits.isError ? (
                <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
                  Related unit recommendations are temporarily unavailable.
                </p>
              ) : relatedToOtherCourses.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Related unit suggestions will appear when published units have prerequisite or similarity links.
                </p>
              ) : (
                <div className="grid gap-3">
                  {relatedToOtherCourses.map(recommendation => (
                    <div key={recommendation.unitId} className="flex items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{recommendation.title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {recommendation.courseTitle} · {recommendation.relationType.replace('_', ' ')} to your active unit
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleActivate(recommendation.unitId, recommendation.courseId)}
                        disabled={isSubmitting || activeUnitCount >= MAX_ACTIVE_UNITS}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {activatingUnitId === recommendation.unitId ? 'Adding…' : 'Add unit'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
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
