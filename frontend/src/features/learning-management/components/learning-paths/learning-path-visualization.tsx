'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiService } from '@/features/auth/services/apiClient';
import {
  CheckCircle,
  Circle,
  Lock,
  Play,
  BookOpen,
  FileText,
  Award,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LearningPath, 
  LearningPathProgress, 
  PathPhase, 
  PathModule, 
  Milestone, 
  PhaseProgress, 
  ModuleProgress 
} from '@/shared/types/learningInterface';
import { cn } from '@/lib/utils/cn';

const getProgressBarWidth = (percentage: number): string => {
  return `${Math.min(100, Math.max(0, percentage))}%`;
};

// Safely coerce an unknown value (from API responses) into a display string.
// Avoids @typescript-eslint/no-base-to-string, which flags String(unknown)
// because objects would stringify to "[object Object]".
const toDisplayString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const unwrapApiPayload = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) return value;
  const outerData = (value as Record<string, unknown>).data;
  if (typeof outerData !== 'object' || outerData === null) return outerData ?? value;
  const innerData = (outerData as Record<string, unknown>).data;
  return innerData ?? outerData;
};

const normalizeJsonArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) {
    return Object.values(value);
  }
  return [];
};

type PhaseStatus = 'completed' | 'inProgress' | 'notStarted';
type ModuleStatus = 'completed' | 'inProgress' | 'notStarted' | 'skipped' | 'failed';

const PHASE_STATUSES: readonly PhaseStatus[] = ['completed', 'inProgress', 'notStarted'];
const MODULE_STATUSES: readonly ModuleStatus[] = ['completed', 'inProgress', 'notStarted', 'skipped', 'failed'];

const toPhaseStatus = (value: unknown, fallback: PhaseStatus = 'notStarted'): PhaseStatus =>
  (PHASE_STATUSES as readonly unknown[]).includes(value) ? (value as PhaseStatus) : fallback;

const toModuleStatus = (value: unknown, fallback: ModuleStatus = 'notStarted'): ModuleStatus =>
  (MODULE_STATUSES as readonly unknown[]).includes(value) ? (value as ModuleStatus) : fallback;

interface LearningPathVisualizationProps {
  pathId: string;
}

export const LearningPathVisualization: React.FC<LearningPathVisualizationProps> = ({ pathId }) => {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const router = useRouter();

  const handleEnroll = async () => {
    try {
      setEnrolling(true);
      await apiService.post(`/learning-paths/${pathId}/enroll`, {});
      toast.success('Successfully enrolled in curriculum!');
      if (learningPath) {
        await fetchProgress(learningPath);
      }
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Failed to enroll in curriculum')
          : 'Failed to enroll in curriculum';
      toast.error(errorMsg);
    } finally {
      setEnrolling(false);
    }
  };

  useEffect(() => {
    const loadPath = async () => {
      setLoading(true);
      const path = await fetchLearningPath();
      if (path) {
        await fetchProgress(path);
      } else {
        setLoading(false);
      }
    };
    void loadPath();
  }, [pathId]);

  const fetchLearningPath = async (): Promise<LearningPath | null> => {
    try {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}`);
      const raw = unwrapApiPayload(response);
      const rawObj = raw as Record<string, unknown>;
      const analyticsObj = (rawObj.analytics as Record<string, unknown> | undefined) ?? {};
      const createdByObj = (rawObj.createdBy as Record<string, unknown> | undefined) ?? (rawObj.created_by as Record<string, unknown> | undefined) ?? {};
      const pathStructureObj = (rawObj.pathStructure as Record<string, unknown> | undefined) ?? (rawObj.path_structure as Record<string, unknown> | undefined) ?? {};
      const phasesRaw = Array.isArray(pathStructureObj.phases) ? (pathStructureObj.phases as unknown[]) : [];

      const normalized: LearningPath = {
        id: toDisplayString(rawObj.id ?? rawObj.path_id),
        title: toDisplayString(rawObj.title),
        description: toDisplayString(rawObj.description),
        category: toDisplayString(rawObj.category),
        difficulty: toDisplayString(rawObj.difficulty),
        status: toDisplayString(rawObj.status),
        specialization: rawObj.specialization ? toDisplayString(rawObj.specialization) : undefined,
        pathType: (rawObj.pathType ?? rawObj.path_type) ? toDisplayString(rawObj.pathType ?? rawObj.path_type) : undefined,
        estimatedDurationWeeks: Number(rawObj.estimatedDurationWeeks ?? rawObj.estimated_duration_weeks ?? 0),
        estimatedHoursPerWeek: Number(rawObj.estimatedHoursPerWeek ?? rawObj.estimated_hours_per_week ?? 0),
        tags: Array.isArray(rawObj.tags) ? (rawObj.tags as string[]) : [],
        learningObjectives: Array.isArray(rawObj.learningObjectives)
          ? (rawObj.learningObjectives as string[])
          : Array.isArray(rawObj.learning_objectives)
          ? (rawObj.learning_objectives as string[])
          : [],
        analytics: {
          totalEnrollments: Number(analyticsObj.totalEnrollments ?? analyticsObj.total_enrollments ?? 0),
          completionRate: Number(analyticsObj.completionRate ?? analyticsObj.completion_rate ?? 0),
          userRatings: {
            average: Number((analyticsObj.userRatings as Record<string, unknown> | undefined)?.average ?? (analyticsObj.user_ratings as Record<string, unknown> | undefined)?.average ?? 0),
            count: Number((analyticsObj.userRatings as Record<string, unknown> | undefined)?.count ?? (analyticsObj.user_ratings as Record<string, unknown> | undefined)?.count ?? 0),
          }
        },
        createdBy: {
          id: toDisplayString(createdByObj.id ?? createdByObj.user_id ?? createdByObj.userId),
          firstName: toDisplayString(createdByObj.firstName ?? createdByObj.first_name),
          lastName: toDisplayString(createdByObj.lastName ?? createdByObj.last_name),
        },
        courses: Array.isArray(rawObj.courses) ? (rawObj.courses as LearningPath['courses']) : [],
        milestones: Array.isArray(rawObj.milestones)
          ? (rawObj.milestones as unknown[]).map(m => {
              const milestone = m as Record<string, unknown>;
              const rewards = milestone.rewards as Record<string, unknown> | undefined;
              return {
                id: toDisplayString(milestone.id),
                title: toDisplayString(milestone.title),
                description: toDisplayString(milestone.description ?? milestone.desc),
                type: toDisplayString(milestone.type),
                order: Number(milestone.order ?? 0),
                isRequired: Boolean(milestone.isRequired ?? milestone.is_required ?? false),
                rewards: rewards ? {
                  points: Number(rewards.points ?? 0),
                  badgeId: toDisplayString(rewards.badgeId ?? rewards.badge_id),
                  certificate: rewards.certificate as Record<string, unknown> | undefined,
                } : undefined,
              } as Milestone;
            })
          : [],
        pathStructure: {
          phases: phasesRaw.map(p => {
            const phase = p as Record<string, unknown>;
            const modules = Array.isArray(phase.modules) ? phase.modules as unknown[] : [];
            return {
              id: toDisplayString(phase.id),
              title: toDisplayString(phase.title),
              description: toDisplayString(phase.description),
              order: Number(phase.order ?? 0),
              estimatedWeeks: Number(phase.estimatedWeeks ?? phase.estimated_weeks ?? 0),
              modules: modules.map(m => {
                const moduleItem = m as Record<string, unknown>;
                return {
                  id: toDisplayString(moduleItem.id),
                  title: toDisplayString(moduleItem.title),
                  description: toDisplayString(moduleItem.description),
                  type: toDisplayString(moduleItem.type, 'course'),
                  resourceId: toDisplayString(moduleItem.resourceId ?? moduleItem.resource_id),
                  estimatedHours: Number(moduleItem.estimatedHours ?? moduleItem.estimated_hours ?? 0),
                  isRequired: Boolean(moduleItem.isRequired ?? moduleItem.is_required ?? false),
                  unlockConditions: Array.isArray(moduleItem.unlockConditions)
                    ? moduleItem.unlockConditions.map(String)
                    : Array.isArray(moduleItem.unlock_conditions)
                    ? moduleItem.unlock_conditions.map(String)
                    : [],
                  order: Number(moduleItem.order ?? 0),
                } as PathModule;
              }),
            } as PathPhase;
          }),
        }
      };
      
      setLearningPath(normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching learning path:', error);
      toast.error('Failed to load learning path details');
      return null;
    }
  };

  const fetchProgress = async (path: LearningPath) => {
    try {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}/progress`);
      const raw = unwrapApiPayload(response);
      const rawObj = raw as Record<string, unknown>;

      if (!rawObj) return;

      const phaseProgressRaw = normalizeJsonArray(
        rawObj.phaseProgress ?? rawObj.phase_progress,
      );
      const moduleProgressRaw = normalizeJsonArray(
        rawObj.moduleProgress ?? rawObj.module_progress,
      );
      const milestonesAchievedRaw = normalizeJsonArray(
        rawObj.milestonesAchieved ?? rawObj.milestones_achieved,
      );

      const normalized: LearningPathProgress = {
        id: toDisplayString(rawObj.id),
        status: toDisplayString(rawObj.status, 'notStarted'),
        startedAt: toDisplayString(rawObj.startedAt ?? rawObj.started_at, new Date().toISOString()),
        lastAccessedAt: toDisplayString(rawObj.lastAccessedAt ?? rawObj.last_accessed_at, new Date().toISOString()),
        totalTimeSpentMinutes: Number(rawObj.totalTimeSpentMinutes ?? rawObj.total_time_spent_minutes ?? 0),
        streakDays: Number(rawObj.streakDays ?? rawObj.streak_days ?? 0),
        learningPath: path,
        overallProgressPercentage: Number(rawObj.overallProgressPercentage ?? rawObj.overall_progress_percentage ?? 0),
        currentPhaseIndex: Number(rawObj.currentPhaseIndex ?? rawObj.current_phase_index ?? 0),
        currentModuleIndex: Number(rawObj.currentModuleIndex ?? rawObj.current_module_index ?? 0),
        phaseProgress: phaseProgressRaw.map((p: unknown) => {
          const phase = p as Record<string, unknown>;
          return {
            phaseId: toDisplayString(phase.phaseId ?? phase.phase_id),
            status: toPhaseStatus(phase.status),
            progressPercentage: Number(phase.progressPercentage ?? phase.progress_percentage ?? 0),
            modulesCompleted: Array.isArray(phase.modulesCompleted)
              ? phase.modulesCompleted.map(String)
              : Array.isArray(phase.modules_completed)
              ? phase.modules_completed.map(String)
              : [],
            currentModuleId: toDisplayString(phase.currentModuleId ?? phase.current_module_id),
          };
        }),
        moduleProgress: moduleProgressRaw.map((m: unknown) => {
          const moduleItem = m as Record<string, unknown>;
          const bestScoreRaw = moduleItem.bestScore ?? moduleItem.best_score;
          return {
            moduleId: toDisplayString(moduleItem.moduleId ?? moduleItem.module_id),
            phaseId: toDisplayString(moduleItem.phaseId ?? moduleItem.phase_id),
            status: toModuleStatus(moduleItem.status),
            progressPercentage: Number(moduleItem.progressPercentage ?? moduleItem.progress_percentage ?? 0),
            timeSpentMinutes: Number(moduleItem.timeSpentMinutes ?? moduleItem.time_spent_minutes ?? 0),
            bestScore: typeof bestScoreRaw === 'number' ? bestScoreRaw : undefined,
          };
        }),
        milestonesAchieved: milestonesAchievedRaw.map((m: unknown) => {
          const milestone = m as Record<string, unknown>;
          return {
            milestoneId: toDisplayString(milestone.milestoneId ?? milestone.milestone_id),
            achievedAt: toDisplayString(milestone.achievedAt ?? milestone.achieved_at, new Date().toISOString()),
          };
        }),
      };
      
      setProgress(normalized);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!learningPath) return;

    const refreshProgress = () => {
      if (document.visibilityState === 'visible') {
        void fetchProgress(learningPath);
      }
    };

    window.addEventListener('focus', refreshProgress);
    document.addEventListener('visibilitychange', refreshProgress);
    return () => {
      window.removeEventListener('focus', refreshProgress);
      document.removeEventListener('visibilitychange', refreshProgress);
    };
  }, [learningPath, pathId]);

  const getModuleProgress = (moduleId: string): ModuleProgress | undefined => {
    return (progress?.moduleProgress || []).find(mp => mp.moduleId === moduleId);
  };

  const getPhaseProgress = (phaseId: string): PhaseProgress | undefined => {
    return (progress?.phaseProgress || []).find(pp => pp.phaseId === phaseId);
  };

  const activePhaseIndex = (() => {
    const phases = progress?.phaseProgress || [];
    const inProgressIndex = phases.findIndex(phase => phase.status === 'inProgress');
    return inProgressIndex >= 0
      ? inProgressIndex
      : phases.findIndex(phase => phase.status !== 'completed');
  })();

  const isMilestoneAchieved = (milestoneId: string): boolean => {
    return (progress?.milestonesAchieved || []).some(ma => ma.milestoneId === milestoneId) || false;
  };

  const isModuleUnlocked = (module: PathModule, _phase: PathPhase): boolean => {
    if (!module.unlockConditions || module.unlockConditions.length === 0) {
      return true;
    }
    return (module.unlockConditions || []).every((conditionId: string) => {
      const moduleProgress = getModuleProgress(conditionId);
      return moduleProgress?.status === 'completed';
    });
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'course': return BookOpen;
      case 'assessment': return FileText;
      case 'clinical_case': return Users;
      case 'milestone': return Award;
      default: return Circle;
    }
  };

  const statusMap = {
    completed: { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
    inProgress: { color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/20' },
    notStarted: { color: 'text-muted-foreground', bg: 'bg-background dark:bg-secondary/5', border: 'border-border dark:border-border' },
    skipped: { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
    failed: { color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/20' },
  };

  const handleModuleClick = (module: PathModule, phase: PathPhase) => {
    if (!module.resourceId) return;
    if (!isModuleUnlocked(module, phase)) {
      toast.error("Complete previous modules to unlock this one.");
      return;
    }
    switch (module.type) {
      case 'course': router.push(`/courses/${module.resourceId}`); break;
      case 'assessment': router.push(`/assessment/${module.resourceId}`); break;
      case 'clinical_case':
      case 'clinicalCase':
        router.push(`/clinical-cases/${module.resourceId}`);
        break;
      default: toast.info(`Navigation for type '${module.type}' is not yet implemented.`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full"
        />
        <p className="text-muted-foreground animate-pulse font-medium">Preparing your journey...</p>
      </div>
    );
  }

  if (!learningPath) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Learning path not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* ── Header ── */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-4">
          <Link href="/learning-paths" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Learning Paths
          </Link>
          <span className="text-muted-foreground/60">/</span>
          {learningPath.specialization && (
            <>
              <span className="hover:text-foreground">{learningPath.specialization}</span>
              <span className="text-muted-foreground/60">/</span>
            </>
          )}
          <span className="text-foreground dark:text-foreground font-semibold line-clamp-1">{learningPath.title}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                {learningPath.pathType === 'CLINICAL_COMPETENCY'
                  ? 'Clinical Clerkship'
                  : learningPath.pathType === 'EXAM_BLUEPRINT'
                  ? 'Exam Blueprint'
                  : 'Study Curriculum'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                {learningPath.difficulty || 'All Levels'}
              </span>
              {learningPath.estimatedDurationWeeks > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {learningPath.estimatedDurationWeeks} Weeks
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground dark:text-foreground tracking-tight leading-tight">
              {learningPath.title}
            </h1>
            <p className="text-base text-muted-foreground dark:text-muted-foreground max-w-2xl leading-relaxed">
              {learningPath.description}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-border bg-secondary dark:bg-card flex items-center justify-center overflow-hidden">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {learningPath.analytics.totalEnrollments}+ Learners
              </p>
            </div>

            {progress && progress.status !== 'notStarted' ? (
              <button
                type="button"
                onClick={() => {
                  const firstIncompletePhase = (learningPath.pathStructure?.phases || []).find(
                    (p) => getPhaseProgress(p.id)?.status !== 'completed'
                  );
                  if (firstIncompletePhase) {
                    setSelectedPhase(firstIncompletePhase.id);
                  }
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Continue Curriculum
              </button>
            ) : (
              <button
                type="button"
                disabled={enrolling}
                onClick={handleEnroll}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {enrolling ? 'Enrolling...' : 'Enroll in Curriculum'}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Content Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* ── Left Column: Journey Roadmap ── */}
        <div className="lg:col-span-2 space-y-12">
          
          <section className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground dark:text-foreground">Learning Journey</h2>
            </div>

            <div className="relative pl-12 space-y-10">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-linear-to-b from-indigo-500 via-indigo-500 to-neutral-200 dark:to-neutral-800" />

              {(learningPath.pathStructure?.phases || []).map((phase, idx) => {
                const phaseProgress = getPhaseProgress(phase.id);
                const isActive = activePhaseIndex === idx;
                const isCompleted = phaseProgress?.status === 'completed';

                return (
                  <motion.div 
                    key={phase.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative group"
                  >
                    {/* Phase Circle Icon */}
                    <div className={cn(
                      "absolute -left-12 top-0 w-12 h-12 rounded-full border-4 border-white dark:border-border z-10 flex items-center justify-center transition-all duration-500",
                      isCompleted ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]" :
                      isActive ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-110" :
                      "bg-muted dark:bg-card text-muted-foreground"
                    )}>
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : 
                       isActive ? <Play className="w-5 h-5 ml-0.5" /> : 
                       <span className="text-sm font-bold">{idx + 1}</span>}
                    </div>

                    {/* Phase Card */}
                    <div className={cn(
                      "rounded-3xl p-6 transition-all duration-300 border",
                      isActive ? "bg-card dark:bg-card border-indigo-200 dark:border-indigo-500/30 shadow-xl shadow-indigo-500/5" :
                      "bg-background/50 dark:bg-card/50 border-border dark:border-border opacity-80"
                    )}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Phase {idx + 1}</p>
                          <h3 className="text-xl font-bold text-foreground dark:text-muted-foreground">{phase.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted dark:bg-card text-xs font-semibold text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {phase.estimatedWeeks}w
                        </div>
                      </div>

                      <p className="text-muted-foreground dark:text-muted-foreground text-sm mb-6 leading-relaxed">
                        {phase.description}
                      </p>

                      {/* Phase Progress Bar */}
                      {phaseProgress && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                            <span>Phase Completion</span>
                            <span className="text-indigo-500">{Math.round(phaseProgress.progressPercentage)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-secondary dark:bg-card rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: getProgressBarWidth(phaseProgress.progressPercentage) }}
                              className="h-full bg-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <BookOpen className="w-3.5 h-3.5" />
                            {phase.modules.length} Modules
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setSelectedPhase(selectedPhase === phase.id ? null : phase.id)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            selectedPhase === phase.id 
                            ? "bg-neutral-900 dark:bg-card text-white dark:text-foreground"
                            : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                          )}
                        >
                          {selectedPhase === phase.id ? 'Close Modules' : isActive ? 'Resume Phase' : 'Explore Modules'}
                        </button>
                      </div>

                      {/* ── Modules List ── */}
                      <AnimatePresence>
                        {selectedPhase === phase.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-6 space-y-3 overflow-hidden"
                          >
                            <div className="h-px bg-secondary dark:bg-card mb-6" />
                            {phase.modules.map((module, mIdx) => {
                              const moduleProgress = getModuleProgress(module.id);
                              const isUnlocked = isModuleUnlocked(module, phase);
                              const Icon = getModuleIcon(module.type);
                              const status = statusMap[toModuleStatus(moduleProgress?.status)];

                              return (
                                <motion.div
                                  key={module.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: mIdx * 0.05 }}
                                  onClick={() => handleModuleClick(module, phase)}
                                  className={cn(
                                    "group/module flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200",
                                    isUnlocked 
                                    ? "bg-card dark:bg-card/50 border-border dark:border-border cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5"
                                    : "bg-background/50 dark:bg-card/50 border-border dark:border-border cursor-not-allowed opacity-60"
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                    status.bg
                                  )}>
                                    {isUnlocked ? <Icon className={cn("w-5 h-5", status.color)} /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                                  </div>

                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-foreground dark:text-muted-foreground group-hover/module:text-indigo-500 transition-colors">
                                      {module.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{module.type.replace('_', ' ')}</span>
                                      <span className="w-1 h-1 rounded-full bg-secondary dark:bg-secondary" />
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{module.estimatedHours} Hours</span>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    {moduleProgress?.status === 'completed' ? (
                                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <p className="text-sm font-black text-foreground dark:text-foreground tabular-nums">
                                        {Math.round(moduleProgress?.progressPercentage || 0)}%
                                      </p>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Right Column: Stats & Milestones ── */}
        <div className="space-y-8">
          
          {/* Progress Card */}
          <section className="bg-neutral-900 dark:bg-background rounded-4xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/10">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px]" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-[60px]" />
            
            <div className="relative z-10">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Total Mastery</h3>
                <span className="text-5xl font-black text-white italic">{Math.round(progress?.overallProgressPercentage || 0)}%</span>
              </div>

              <div className="h-2 w-full bg-card/10 rounded-full overflow-hidden mb-8">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: getProgressBarWidth(progress?.overallProgressPercentage || 0) }}
                  className="h-full bg-linear-to-r from-indigo-500 to-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">{(progress?.phaseProgress || []).filter(p => p.status === 'completed').length}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phases completed</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">{(progress?.moduleProgress || []).filter(m => m.status === 'completed').length}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Modules completed</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">
                    {Math.floor((progress?.totalTimeSpentMinutes ?? 0) / 60)}h
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Path study time</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">{progress?.streakDays ?? 0}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Path streak days</p>
                </div>
              </div>
            </div>
          </section>

          {/* Milestones */}
          {learningPath.milestones && learningPath.milestones.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-lg font-bold text-foreground dark:text-foreground">Milestones</h3>
                <span className="text-xs font-bold text-indigo-500">{(progress?.milestonesAchieved || []).length} / {learningPath.milestones.length}</span>
              </div>

              <div className="space-y-3">
                {learningPath.milestones.map(milestone => {
                  const isAchieved = isMilestoneAchieved(milestone.id);

                  return (
                    <motion.div
                      key={milestone.id}
                      whileHover={{ x: 5 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300",
                        isAchieved 
                        ? "bg-card dark:bg-card border-indigo-100 dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5"
                        : "bg-background/50 dark:bg-card/50 border-border dark:border-border opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                        isAchieved ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-secondary dark:bg-card text-muted-foreground"
                      )}>
                        <Award className={cn("w-6 h-6", isAchieved ? "animate-pulse" : "")} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-foreground dark:text-muted-foreground">{milestone.title}</h4>
                        <p className="text-[11px] text-muted-foreground dark:text-muted-foreground font-medium line-clamp-1">{milestone.description}</p>
                      </div>
                      {isAchieved && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Specialization Context */}
          <section className="bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-bold text-foreground dark:text-foreground uppercase tracking-widest">Path Insights</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">Target Level: <span className="text-foreground dark:text-foreground">{learningPath.difficulty}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground">Estimated Total: <span className="text-foreground dark:text-foreground">{learningPath.estimatedDurationWeeks} Weeks</span></p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};