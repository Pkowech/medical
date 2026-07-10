import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
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
  onClose: () => void;
  onComplete: () => void;
}

export const UnitSelectionModal = ({ course, onClose, onComplete }: UnitSelectionModalProps) => {
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [activeConcurrentCount, setActiveConcurrentCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MAX_CONCURRENT = 4;

  useEffect(() => {
    fetchCurrentStats();
  }, []);

  const fetchCurrentStats = async () => {
    try {
      const stats = await courseService.getCourseStats();
      setActiveConcurrentCount(stats.inProgress || 0);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const toggleUnit = (unitId: string) => {
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter(id => id !== unitId));
      setError(null);
    } else {
      if (selectedUnits.length >= 5) {
        setError('You can select a maximum of 5 units for initial enrollment.');
        return;
      }
      if (activeConcurrentCount + selectedUnits.length >= MAX_CONCURRENT) {
        setError(`You have reached the concurrent unit limit of ${MAX_CONCURRENT}. Free up slots by completing units.`);
        return;
      }
      setSelectedUnits([...selectedUnits, unitId]);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (selectedUnits.length === 0) {
      setError('Please select at least 1 unit to start.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Activate each selected unit
      for (const unitId of selectedUnits) {
        await courseService.activateUnit(unitId, MAX_CONCURRENT);
      }
      onComplete();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err instanceof Error ? err.message : String(err));
      setError(message || 'Failed to activate units. Check concurrent limits.');
    } finally {
      setIsSubmitting(false);
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
              <p>Pick 2-5 units to start focusing on. You can have up to <strong>{MAX_CONCURRENT}</strong> units active at once across all courses. Currently using <strong>{activeConcurrentCount}</strong> slots.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Available Units</h3>
            {units.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No units available for this course.</p>
            ) : (
              <div className="grid gap-3">
                {units.map((unit) => {
                  const isSelected = selectedUnits.includes(unit.id);
                  return (
                    <button
                      key={unit.id}
                      onClick={() => toggleUnit(unit.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-500' 
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'}`}>
                            {unit.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1">
                            {unit.description || 'Comprehensive learning module'}
                          </p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-200 dark:text-slate-700" />
                      )}
                    </button>
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
          
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium">
              <span className="text-slate-500 dark:text-slate-400">Selected: </span>
              <span className={selectedUnits.length > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                {selectedUnits.length} / 5
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedUnits.length === 0}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              {isSubmitting ? 'Activating...' : 'Start Learning'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
