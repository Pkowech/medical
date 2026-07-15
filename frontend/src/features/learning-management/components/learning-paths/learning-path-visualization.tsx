'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

interface LearningPathVisualizationProps {
  pathId: string;
}

export const LearningPathVisualization: React.FC<LearningPathVisualizationProps> = ({ pathId }) => {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<LearningPathProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchLearningPath();
    fetchProgress();
  }, [pathId]);

  const fetchLearningPath = async () => {
    try {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}`);
      const raw = response?.data ?? response;
      const rawObj = raw as Record<string, unknown>;
      
      const normalized: LearningPath = {
        id: raw.id,
        title: raw.title || '',
        description: raw.description || '',
        category: raw.category || '',
        difficulty: raw.difficulty || '',
        status: raw.status || '',
        estimatedDurationWeeks: raw.estimatedDurationWeeks || raw.estimated_duration_weeks || 0,
        estimatedHoursPerWeek: raw.estimatedHoursPerWeek || raw.estimated_hours_per_week || 0,
        tags: raw.tags || [],
        learningObjectives: raw.learningObjectives || raw.learning_objectives || [],
        analytics: {
          totalEnrollments: raw.analytics?.totalEnrollments || raw.analytics?.total_enrollments || 0,
          completionRate: raw.analytics?.completionRate || raw.analytics?.completion_rate || 0,
          userRatings: {
            average: raw.analytics?.userRatings?.average || raw.analytics?.user_ratings?.average || 0,
            count: raw.analytics?.userRatings?.count || raw.analytics?.user_ratings?.count || 0
          }
        },
        createdBy: {
          id: raw.createdBy?.id || raw.created_by?.id || '',
          firstName: raw.createdBy?.firstName || raw.created_by?.first_name || '',
          lastName: raw.createdBy?.lastName || raw.created_by?.last_name || ''
        },
        courses: raw.courses || [],
        milestones: Array.isArray(rawObj.milestones)
          ? (rawObj.milestones as unknown[]).map(m => {
              const milestone = m as Record<string, unknown>;
              const rewards = milestone.rewards as Record<string, unknown> | undefined;
              return {
                id: String(milestone.id ?? ''),
                title: String(milestone.title ?? ''),
                description: String(milestone.description ?? milestone.desc ?? ''),
                type: String(milestone.type ?? ''),
                order: Number(milestone.order ?? 0),
                isRequired: Boolean(milestone.isRequired ?? milestone.is_required ?? false),
                rewards: rewards ? {
                  points: Number(rewards.points ?? 0),
                  badgeId: String(rewards.badgeId ?? rewards.badge_id ?? ''),
                  certificate: rewards.certificate as Record<string, unknown> | undefined,
                } : undefined,
              } as Milestone;
            })
          : [],
        pathStructure: {
          phases: Array.isArray(rawObj.pathStructure?.phases ?? rawObj.path_structure?.phases)
            ? ((rawObj.pathStructure?.phases ?? rawObj.path_structure?.phases) as unknown[]).map(p => {
                const phase = p as Record<string, unknown>;
                const modules = Array.isArray(phase.modules) ? phase.modules as unknown[] : [];
                return {
                  id: String(phase.id ?? ''),
                  title: String(phase.title ?? ''),
                  description: String(phase.description ?? ''),
                  order: Number(phase.order ?? 0),
                  estimatedWeeks: Number(phase.estimatedWeeks ?? phase.estimated_weeks ?? 0),
                  modules: modules.map(m => {
                    const moduleItem = m as Record<string, unknown>;
                    return {
                      id: String(moduleItem.id ?? ''),
                      title: String(moduleItem.title ?? ''),
                      description: String(moduleItem.description ?? ''),
                      type: String(moduleItem.type ?? 'course'),
                      resourceId: String(moduleItem.resourceId ?? moduleItem.resource_id ?? ''),
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
              })
            : [],
        }
      };
      
      setLearningPath(normalized);
    } catch (error) {
      console.error('Error fetching learning path:', error);
      toast.error('Failed to load learning path details');
    }
  };

  const fetchProgress = async () => {
    try {
      const response = await apiService.get<unknown>(`/learning-paths/${pathId}/progress`);
      const raw = response?.data ?? response;
      const rawObj = raw as Record<string, unknown>;
      
      if (!rawObj) return;

      const phaseProgressRaw = Array.isArray(raw.phaseProgress)
        ? raw.phaseProgress
        : Array.isArray(raw.phase_progress)
        ? raw.phase_progress
        : [];
      const moduleProgressRaw = Array.isArray(raw.moduleProgress)
        ? raw.moduleProgress
        : Array.isArray(raw.module_progress)
        ? raw.module_progress
        : [];
      const milestonesAchievedRaw = Array.isArray(raw.milestonesAchieved)
        ? raw.milestonesAchieved
        : Array.isArray(raw.milestones_achieved)
        ? raw.milestones_achieved
        : [];

      const normalized: LearningPathProgress = {
        id: String(raw.id ?? ''),
        status: String(raw.status ?? 'notStarted'),
        startedAt: String(raw.startedAt ?? raw.started_at ?? new Date().toISOString()),
        lastAccessedAt: String(raw.lastAccessedAt ?? raw.last_accessed_at ?? new Date().toISOString()),
        learningPath: learningPath!, 
        overallProgressPercentage: Number(raw.overallProgressPercentage ?? raw.overall_progress_percentage ?? 0),
        currentPhaseIndex: Number(raw.currentPhaseIndex ?? raw.current_phase_index ?? 0),
        currentModuleIndex: Number(raw.currentModuleIndex ?? raw.current_module_index ?? 0),
        phaseProgress: phaseProgressRaw.map((p: unknown) => {
          const phase = p as Record<string, unknown>;
          return {
            phaseId: String(phase.phaseId ?? phase.phase_id ?? ''),
            status: String(phase.status ?? 'notStarted'),
            progressPercentage: Number(phase.progressPercentage ?? phase.progress_percentage ?? 0),
            modulesCompleted: Array.isArray(phase.modulesCompleted)
              ? phase.modulesCompleted.map(String)
              : Array.isArray(phase.modules_completed)
              ? phase.modules_completed.map(String)
              : [],
            currentModuleId: String(phase.currentModuleId ?? phase.current_module_id ?? ''),
          };
        }),
        moduleProgress: moduleProgressRaw.map((m: unknown) => {
          const moduleItem = m as Record<string, unknown>;
          return {
            moduleId: String(moduleItem.moduleId ?? moduleItem.module_id ?? ''),
            phaseId: String(moduleItem.phaseId ?? moduleItem.phase_id ?? ''),
            status: String(moduleItem.status ?? 'notStarted'),
            progressPercentage: Number(moduleItem.progressPercentage ?? moduleItem.progress_percentage ?? 0),
            timeSpentMinutes: Number(moduleItem.timeSpentMinutes ?? moduleItem.time_spent_minutes ?? 0),
            bestScore: moduleItem.bestScore ?? moduleItem.best_score,
          };
        }),
        milestonesAchieved: milestonesAchievedRaw.map((m: unknown) => {
          const milestone = m as Record<string, unknown>;
          return {
            milestoneId: String(milestone.milestoneId ?? milestone.milestone_id ?? ''),
            achievedAt: String(milestone.achievedAt ?? milestone.achieved_at ?? new Date().toISOString()),
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

  const getModuleProgress = (moduleId: string): ModuleProgress | undefined => {
    return (progress?.moduleProgress || []).find(mp => mp.moduleId === moduleId);
  };

  const getPhaseProgress = (phaseId: string): PhaseProgress | undefined => {
    return (progress?.phaseProgress || []).find(pp => pp.phaseId === phaseId);
  };

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
    notStarted: { color: 'text-neutral-400', bg: 'bg-neutral-50 dark:bg-neutral-500/5', border: 'border-neutral-200 dark:border-neutral-700' },
    skipped: { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
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
      case 'clinicalCase': router.push(`/clinical-cases/${module.resourceId}`); break;
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
        <p className="text-neutral-500 animate-pulse font-medium">Preparing your journey...</p>
      </div>
    );
  }

  if (!learningPath) {
    return (
      <div className="text-center py-24">
        <p className="text-neutral-500">Learning path not found</p>
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
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium text-sm mb-6 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
          Back to Specializations
        </button>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight leading-tight">
              {learningPath.title}
            </h1>
            <p className="text-lg text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
              {learningPath.description}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                  <Users className="w-4 h-4 text-neutral-400" />
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
              Join {learningPath.analytics.totalEnrollments}+ Learners
            </p>
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
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Learning Journey</h2>
            </div>

            <div className="relative pl-12 space-y-10">
              {/* Vertical Timeline Line */}
              <div className="absolute left-6 top-4 bottom-4 w-[2px] bg-gradient-to-b from-indigo-500 via-indigo-500 to-neutral-200 dark:to-neutral-800" />

              {(learningPath.pathStructure?.phases || []).map((phase, idx) => {
                const phaseProgress = getPhaseProgress(phase.id);
                const isActive = progress?.currentPhaseIndex === idx;
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
                      "absolute -left-12 top-0 w-12 h-12 rounded-full border-4 border-white dark:border-neutral-950 z-10 flex items-center justify-center transition-all duration-500",
                      isCompleted ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]" :
                      isActive ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-110" :
                      "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                    )}>
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : 
                       isActive ? <Play className="w-5 h-5 ml-0.5" /> : 
                       <span className="text-sm font-bold">{idx + 1}</span>}
                    </div>

                    {/* Phase Card */}
                    <div className={cn(
                      "rounded-3xl p-6 transition-all duration-300 border",
                      isActive ? "bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-500/30 shadow-xl shadow-indigo-500/5" :
                      "bg-neutral-50/50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 opacity-80"
                    )}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Phase {idx + 1}</p>
                          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{phase.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-500">
                          <Clock className="w-3.5 h-3.5" />
                          {phase.estimatedWeeks}w
                        </div>
                      </div>

                      <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 leading-relaxed">
                        {phase.description}
                      </p>

                      {/* Phase Progress Bar */}
                      {phaseProgress && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                            <span>Phase Completion</span>
                            <span className="text-indigo-500">{Math.round(phaseProgress.progressPercentage)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
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
                          <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
                            <BookOpen className="w-3.5 h-3.5" />
                            {phase.modules.length} Modules
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setSelectedPhase(selectedPhase === phase.id ? null : phase.id)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            selectedPhase === phase.id 
                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900" 
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
                            <div className="h-px bg-neutral-200 dark:bg-neutral-800 mb-6" />
                            {phase.modules.map((module, mIdx) => {
                              const moduleProgress = getModuleProgress(module.id);
                              const isUnlocked = isModuleUnlocked(module, phase);
                              const Icon = getModuleIcon(module.type);
                              const status = statusMap[moduleProgress?.status || 'notStarted'];

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
                                    ? "bg-white dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5" 
                                    : "bg-neutral-50/50 dark:bg-neutral-900/50 border-neutral-100 dark:border-neutral-800 cursor-not-allowed opacity-60"
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                    status.bg
                                  )}>
                                    {isUnlocked ? <Icon className={cn("w-5 h-5", status.color)} /> : <Lock className="w-5 h-5 text-neutral-400" />}
                                  </div>

                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover/module:text-indigo-500 transition-colors">
                                      {module.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{module.type.replace('_', ' ')}</span>
                                      <span className="w-1 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{module.estimatedHours} Hours</span>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    {moduleProgress?.status === 'completed' ? (
                                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <p className="text-sm font-black text-neutral-900 dark:text-white tabular-nums">
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
          <section className="bg-neutral-900 dark:bg-neutral-950 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/10">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px]" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-[60px]" />
            
            <div className="relative z-10">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">Total Mastery</h3>
                <span className="text-5xl font-black text-white italic">{Math.round(progress?.overallProgressPercentage || 0)}%</span>
              </div>

              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-8">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: getProgressBarWidth(progress?.overallProgressPercentage || 0) }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">{(progress?.phaseProgress || []).filter(p => p.status === 'completed').length}</p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Phases Don</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-black text-white">{(progress?.moduleProgress || []).filter(m => m.status === 'completed').length}</p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Modules Don</p>
                </div>
              </div>
            </div>
          </section>

          {/* Milestones */}
          {learningPath.milestones && learningPath.milestones.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6 px-1">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Milestones</h3>
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
                        ? "bg-white dark:bg-neutral-900 border-indigo-100 dark:border-indigo-500/20 shadow-lg shadow-indigo-500/5" 
                        : "bg-neutral-50/50 dark:bg-neutral-900/50 border-neutral-100 dark:border-neutral-800 opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                        isAchieved ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400"
                      )}>
                        <Award className={cn("w-6 h-6", isAchieved ? "animate-pulse" : "")} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-neutral-900 dark:text-neutral-100">{milestone.title}</h4>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium line-clamp-1">{milestone.description}</p>
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
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-widest">Path Insights</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Target Level: <span className="text-neutral-900 dark:text-white">{learningPath.difficulty}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Estimated Total: <span className="text-neutral-900 dark:text-white">{learningPath.estimatedDurationWeeks} Weeks</span></p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
