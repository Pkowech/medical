'use client';

import React, { useState, useEffect } from 'react';
import { usePageHeader } from '@/core/providers/HeaderContext';
import {
  BookOpen,
  Target,
  Clock,
  Users,
  Star,
  CheckCircle,
  Search,
  Calendar,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Activity,
  Zap,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/features/auth/services/apiClient';
import { LearningPath, LearningPathProgress } from '@/shared/types';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import { userService } from '@/features/profile/services/userService';
import { healthcareFieldLabel } from '@/shared/utils/healthcareProfile';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

// Safely coerce an unknown value (from API responses) into a display string.
// Avoids @typescript-eslint/no-base-to-string, which flags String(unknown)
// because objects would stringify to "[object Object]".
const toDisplayString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

type PhaseStatus = 'completed' | 'inProgress' | 'notStarted';
type ModuleStatus = 'completed' | 'inProgress' | 'notStarted' | 'skipped';

const PHASE_STATUSES: readonly PhaseStatus[] = ['completed', 'inProgress', 'notStarted'];
const MODULE_STATUSES: readonly ModuleStatus[] = ['completed', 'inProgress', 'notStarted', 'skipped'];

const toPhaseStatus = (value: unknown, fallback: PhaseStatus = 'notStarted'): PhaseStatus =>
  (PHASE_STATUSES as readonly unknown[]).includes(value) ? (value as PhaseStatus) : fallback;

const toModuleStatus = (value: unknown, fallback: ModuleStatus = 'notStarted'): ModuleStatus =>
  (MODULE_STATUSES as readonly unknown[]).includes(value) ? (value as ModuleStatus) : fallback;

/* ─────────────────────────────── Difficulty Badge ─────────────────────── */
const difficultyMap: Record<string, { label: string; className: string }> = {
  beginner:     { label: 'Beginner',     className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20' },
  intermediate: { label: 'Intermediate', className: 'bg-amber-50  dark:bg-amber-500/10  text-amber-700  dark:text-amber-400  ring-1 ring-amber-200  dark:ring-amber-500/20'  },
  advanced:     { label: 'Advanced',     className: 'bg-rose-50   dark:bg-rose-500/10   text-rose-700   dark:text-rose-400   ring-1 ring-rose-200   dark:ring-rose-500/20'   },
  expert:       { label: 'Expert',       className: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-500/20' },
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const d = difficultyMap[difficulty?.toLowerCase()] ?? { label: difficulty || 'All Levels', className: 'bg-muted text-muted-foreground ring-1 ring-border' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider', d.className)}>
      <Activity className="w-2.5 h-2.5" />
      {d.label}
    </span>
  );
};

/* ─────────────────────────────── Progress Bar ──────────────────────────── */
const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <div className={cn('h-1 w-full bg-muted rounded-full overflow-hidden', className)}>
    <div
      className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 dynamic-width"
      style={{ '--width': `${Math.min(100, Math.max(0, value))}%` } as React.CSSProperties}
    />
  </div>
);

/* ─────────────────────────────── Path Card ─────────────────────────────── */
interface PathCardProps {
  path: LearningPath;
  isEnrolled?: boolean;
  progress?: LearningPathProgress;
  onEnroll: (id: string) => void;
  onNavigate: (id: string) => void;
  onSchedule: () => void;
}

const PathCard: React.FC<PathCardProps> = ({ path, isEnrolled, progress, onEnroll, onNavigate, onSchedule }) => {
  const pct = Math.round(progress?.overallProgressPercentage ?? 0);
  const rating = path.analytics?.userRatings?.average ?? 0;
  const enrollments = path.analytics?.totalEnrollments ?? 0;
  const weeks = path.estimatedDurationWeeks ?? 0;

  return (
    <div
      onClick={() => onNavigate(path.id)}
      className="group relative flex flex-col bg-card text-card-foreground border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 h-full"
    >
      {/* ── Header strip ── */}
      <div className="relative h-32 bg-slate-900 dark:bg-background p-5 flex flex-col justify-between overflow-hidden shrink-0">
        {/* subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04] grid-pattern text-white" />
        {/* glow blob */}
        <div className={cn(
          'absolute top-0 right-0 w-48 h-48 -mr-20 -mt-20 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700',
          (path.difficulty === 'advanced' || path.difficulty === 'expert') ? 'bg-rose-500' : 'bg-indigo-500'
        )} />

        <div className="relative flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-card/10 text-white/70 ring-1 ring-white/10">
              Path
            </span>
            {path.specialization && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-amber-400 text-amber-950">
                <Target className="w-2 h-2" />
                {path.specialization}
              </span>
            )}
          </div>
          {isEnrolled && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30 shrink-0">
              <CheckCircle className="w-2.5 h-2.5" />
              Enrolled
            </span>
          )}
        </div>

        <div className="relative">
          <h3 className="text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-200 transition-colors">{path.title}</h3>
          <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold text-white/50 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {enrollments.toLocaleString()}
            </span>
            {rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {rating.toFixed(1)}
              </span>
            )}
            {weeks > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {weeks}w
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col p-5 gap-4">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{path.description}</p>

        <div className="flex flex-wrap gap-1.5">
          <DifficultyBadge difficulty={path.difficulty} />
          {path.category && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-500/20">
              {path.category}
            </span>
          )}
        </div>

        {/* enrolled progress */}
        {isEnrolled && progress && (
          <div className="p-3.5 bg-muted rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {weeks}w total</span>
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {path.courses?.length ?? 0} courses</span>
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="mt-auto pt-1 space-y-2">
          {!isEnrolled ? (
            <button
              onClick={e => { e.stopPropagation(); onEnroll(path.id); }}
              className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold transition-all shadow-sm shadow-indigo-500/20"
            >
              Enroll in Path
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={e => { e.stopPropagation(); onNavigate(path.id); }}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Courses
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onSchedule(); }}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" /> Schedule
                </button>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onNavigate(path.id); }}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-500/20"
              >
                <Zap className="w-4 h-4" /> Resume Learning
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────── Section Header ───────────────────────── */
/* ─────────────────────────────── Empty State ───────────────────────────── */
const EmptyState: React.FC<{ icon: React.ElementType; title: string; body: string }> = ({ icon: Icon, title, body }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-muted/50">
    <Icon className="w-10 h-10 text-muted-foreground/50 mb-3" strokeWidth={1.25} />
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-1 max-w-xs">{body}</p>
  </div>
);

/* ─────────────────────────────── Main Component ───────────────────────── */
export const LearningPathInterface: React.FC = () => {
  const { setHeader } = usePageHeader();
  const router = useRouter();
  type PathCardData = LearningPath & { isEnrolled?: boolean; progress?: LearningPathProgress };

  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([]);
  const [userProgress, setUserProgress] = useState<LearningPathProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'enrolled' | 'discover' | 'recommended'>('enrolled');
  const [profileFieldLoaded, setProfileFieldLoaded] = useState(false);
  const [profileHealthcareField, setProfileHealthcareField] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const specParam = params.get('specialization');
    if (specParam) setSpecializationFilter(specParam);
    setHeader({ title: 'Learning Paths', description: 'Master your medical career with structured curriculums', icon: '📚' });
    return () => setHeader(null);
  }, [setHeader]);

  useEffect(() => {
    const fetchProfileField = async () => {
      try {
        const profile = await userService.getMyProfile();
        setProfileHealthcareField(profile.healthcareField?.trim() || null);
      } catch (error) {
        console.error('Failed to load healthcare field for learning paths:', error);
        toast.error('Could not load your healthcare field. Search to explore all pathways.');
      } finally {
        setProfileFieldLoaded(true);
      }
    };

    void fetchProfileField();
  }, []);

  useEffect(() => {
    if (profileFieldLoaded) void fetchData();
  }, [profileFieldLoaded, profileHealthcareField, searchTerm, specializationFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLearningPaths(), fetchUserProgress(), fetchRecommendations()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try { setRecommendedPaths(await learningPathService.getRecommendedPaths(3)); }
    catch (err) { console.warn(err); }
  };

  const normalizeLearningPath = (raw: Record<string, unknown>): LearningPath => {
    const analytics = raw.analytics as Record<string, unknown> | undefined;
    const createdBy = raw.createdBy as Record<string, unknown> | undefined;

    return {
      id: toDisplayString(raw.id),
      title: toDisplayString(raw.title ?? raw.name),
      description: toDisplayString(raw.description ?? raw.desc),
      category: toDisplayString(raw.category ?? raw.categoryId),
      difficulty: toDisplayString(raw.difficulty),
      status: toDisplayString(raw.status),
      estimatedDurationWeeks: Number(raw.estimatedDurationWeeks ?? raw.estimated_duration_weeks ?? 0),
      estimatedHoursPerWeek: Number(raw.estimatedHoursPerWeek ?? raw.estimated_hours_per_week ?? 0),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      learningObjectives: Array.isArray(raw.learningObjectives)
        ? raw.learningObjectives.map(String)
        : Array.isArray(raw.learning_objectives)
        ? raw.learning_objectives.map(String)
        : [],
      analytics: {
        totalEnrollments: Number(analytics?.totalEnrollments ?? analytics?.total_enrollments ?? 0),
        completionRate: Number(analytics?.completionRate ?? analytics?.completion_rate ?? 0),
        userRatings: {
          average: Number((analytics?.userRatings as Record<string, unknown>)?.average ?? (analytics?.user_ratings as Record<string, unknown>)?.average ?? 0),
          count: Number((analytics?.userRatings as Record<string, unknown>)?.count ?? (analytics?.user_ratings as Record<string, unknown>)?.count ?? 0),
        },
      },
      createdBy: {
        id: toDisplayString(createdBy?.id ?? createdBy?.user_id),
        firstName: toDisplayString(createdBy?.firstName ?? createdBy?.first_name),
        lastName: toDisplayString(createdBy?.lastName ?? createdBy?.last_name),
      },
      courses: Array.isArray(raw.courses) ? (raw.courses as unknown[]) : [],
      milestones: Array.isArray(raw.milestones)
        ? (raw.milestones as unknown[]).map(milestoneItem => {
            const milestone = milestoneItem as Record<string, unknown>;
            const rewards = milestone.rewards as Record<string, unknown> | undefined;
            return {
              id: toDisplayString(milestone.id),
              title: toDisplayString(milestone.title),
              description: toDisplayString(milestone.description ?? milestone.desc),
              type: toDisplayString(milestone.type),
              order: Number(milestone.order ?? 0),
              isRequired: Boolean(milestone.isRequired ?? milestone.is_required ?? false),
              rewards: rewards
                ? {
                    points: Number(rewards.points ?? 0),
                    badgeId: toDisplayString(rewards.badgeId ?? rewards.badge_id),
                    certificate: rewards.certificate as { templateId: string; title?: string; description?: string } | undefined,
                  }
                : undefined,
            };
          })
        : [],
      specialization: typeof raw.specialization === 'string' ? raw.specialization : undefined,
    };
  };

  const fetchLearningPaths = async () => {
    if (!searchTerm && !profileHealthcareField) {
      setLearningPaths([]);
      return;
    }

    try {
      const q = new URLSearchParams();
      if (searchTerm) {
        q.append('search', searchTerm);
      } else {
        q.append('healthcareField', profileHealthcareField ?? '');
        if (specializationFilter) q.append('specialization', specializationFilter);
      }
      q.append('status', 'published');
      const res = await api.get<Record<string, unknown> | unknown[]>(`/learning-paths?${q}`);
      const raw = (res.data && typeof res.data === 'object' && !Array.isArray(res.data))
        ? (res.data.data ?? res.data.learningPaths ?? [])
        : res.data;
      setLearningPaths((Array.isArray(raw) ? raw : []).map(normalizeLearningPath));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load learning paths.');
      setLearningPaths([]);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const data = await learningPathService.getMyProgress();
      if (Array.isArray(data)) {
        setUserProgress(data.map(p => {
          const rawRecord = p as unknown as Record<string, unknown>;
          const rawPath = rawRecord.learningPath ?? rawRecord.learning_path;
          const path = normalizeLearningPath(rawPath as Record<string, unknown>);
          const asRecord = rawRecord;

          const phaseProgressRaw = Array.isArray(asRecord.phaseProgress)
            ? asRecord.phaseProgress
            : Array.isArray(asRecord.phase_progress)
            ? asRecord.phase_progress
            : [];
          const moduleProgressRaw = Array.isArray(asRecord.moduleProgress)
            ? asRecord.moduleProgress
            : Array.isArray(asRecord.module_progress)
            ? asRecord.module_progress
            : [];
          const milestonesRaw = Array.isArray(asRecord.milestonesAchieved)
            ? asRecord.milestonesAchieved
            : Array.isArray(asRecord.milestones_achieved)
            ? asRecord.milestones_achieved
            : [];

          return {
            id: toDisplayString(asRecord.id),
            overallProgressPercentage: Number(asRecord.overallProgressPercentage ?? asRecord.overall_progress_percentage ?? 0),
            status: toDisplayString(asRecord.status),
            startedAt: toDisplayString(asRecord.startedAt ?? asRecord.started_at, new Date().toISOString()),
            lastAccessedAt: toDisplayString(asRecord.lastAccessedAt ?? asRecord.last_accessed_at, new Date().toISOString()),
            learningPath: path,
            milestonesAchieved: milestonesRaw.map((m: unknown) => {
              const milestone = m as Record<string, unknown>;
              return {
                milestoneId: toDisplayString(milestone.milestoneId ?? milestone.milestone_id),
                achievedAt: toDisplayString(milestone.achievedAt ?? milestone.achieved_at, new Date().toISOString()),
              };
            }),
            currentPhaseIndex: Number(asRecord.currentPhaseIndex ?? asRecord.current_phase_index ?? 0),
            currentModuleIndex: Number(asRecord.currentModuleIndex ?? asRecord.current_module_index ?? 0),
            phaseProgress: phaseProgressRaw.map((pp: unknown) => {
              const phase = pp as Record<string, unknown>;
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
            moduleProgress: moduleProgressRaw.map((mp: unknown) => {
              const mod = mp as Record<string, unknown>;
              return {
                moduleId: toDisplayString(mod.moduleId ?? mod.module_id),
                phaseId: toDisplayString(mod.phaseId ?? mod.phase_id),
                status: toModuleStatus(mod.status),
                progressPercentage: Number(mod.progressPercentage ?? mod.progress_percentage ?? 0),
                timeSpentMinutes: Number(mod.timeSpentMinutes ?? mod.time_spent_minutes ?? 0),
                bestScore: mod.bestScore ?? mod.best_score,
              };
            }),
          } as LearningPathProgress;
        }));
      } else {
        setUserProgress([]);
      }
    } catch (err: unknown) {
      console.error('fetchUserProgress error', err);
      setUserProgress([]);
    }
  };

  const enrollInPath = async (pathId: string) => {
    try {
      await api.post(`/learning-paths/${pathId}/enroll`, {
        preferences: { daily_study_goal_minutes: 60, reminder_settings: { enabled: true, frequency: 'daily', time: '09:00' } },
      });
      toast.success('Successfully enrolled in learning path');
      await fetchUserProgress();
      router.push(`/learning-paths/${pathId}`);
    } catch (err: unknown) {
      console.error('Enrollment error:', err);
      let message = 'Failed to enroll in learning path.';
      if (typeof err === 'object' && err !== null) {
        const e = err as Record<string, unknown>;
        if (typeof e.message === 'string') message = e.message;
      }
      toast.error(message);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setActiveTab('discover');
  };

  const enrolledPaths: PathCardData[] = userProgress.map(p => ({ ...p.learningPath, isEnrolled: true, progress: p }));
  const normalizedProfileField = profileHealthcareField?.toLowerCase().replace(/[_-]/g, ' ');
  const relevantRecommendedPaths = normalizedProfileField
    ? recommendedPaths.filter(path =>
        [path.category, path.specialization].some(value =>
          value?.toLowerCase().replace(/[_-]/g, ' ').includes(normalizedProfileField),
        ),
      )
    : [];
  const pathwayTabs = [
    { id: 'enrolled', label: 'Mine', icon: BookOpen },
    { id: 'discover', label: 'Discover', icon: Search },
    { id: 'recommended', label: 'For You', icon: Star },
  ] as const;

  const cardProps = (path: PathCardData) => ({
    path,
    isEnrolled: path.isEnrolled,
    progress: path.progress,
    onEnroll: enrollInPath,
    onNavigate: (id: string) => router.push(`/learning-paths/${id}`),
    onSchedule: () => router.push('/study-planner/schedule'),
  });

  return (
    <div className="min-h-full bg-[#f8f9fa] p-4 text-foreground dark:bg-background md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:p-4">
          <div
            role="group"
            aria-label="Learning pathway views"
            className="grid w-full items-center gap-1 rounded-full bg-muted p-1 sm:w-fit sm:grid-cols-3"
          >
            {pathwayTabs.map(tab => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id !== 'discover') {
                      setSearchInput('');
                      setSearchTerm('');
                    }
                  }}
                  className={cn(
                    'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-background text-indigo-700 shadow-sm dark:bg-card dark:text-indigo-300'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSearch} className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="learning-path-search" className="sr-only">Search all learning pathways</label>
            <input
              id="learning-path-search"
              type="text"
              placeholder="Search pathways"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-11 w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchTerm('');
                }}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>

        {activeTab === 'discover' && (
          <p className="flex flex-wrap items-center gap-2 px-1 text-sm text-muted-foreground">
            {searchTerm ? (
              <>
                <span>Searching all fields for</span>
                <span className="font-semibold text-foreground">&ldquo;{searchTerm}&rdquo;</span>
              </>
            ) : profileHealthcareField ? (
              <>
                <span>Showing pathways for</span>
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {healthcareFieldLabel(profileHealthcareField)}
                </span>
                <span>Search to explore other fields.</span>
              </>
            ) : (
              <span>Search to explore pathways across all healthcare fields.</span>
            )}
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearchTerm('');
                }}
                className="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-300"
              >
                Clear search
              </button>
            )}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading pathways">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-3">
                <div className="h-24 animate-pulse rounded-lg bg-muted" />
                <div className="mt-4 space-y-3">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-10 animate-pulse rounded-lg bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'enrolled' ? (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">My Pathways</h2>
                <span className="text-sm font-medium text-muted-foreground" aria-live="polite">
                  {enrolledPaths.length} enrolled
                </span>
              </div>
              {enrolledPaths.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {enrolledPaths.map(path => <PathCard key={`enrolled-${path.id}`} {...cardProps(path)} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-card px-5 py-10">
                  <div className="mb-4 rounded-full bg-indigo-50 p-4 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <BookOpen aria-hidden="true" className="h-9 w-9" />
                  </div>
                  <h3 className="text-center text-xl font-bold text-foreground">You haven&apos;t enrolled in any pathways yet.</h3>
                  <p className="mt-2 max-w-xs text-center text-sm text-muted-foreground">
                    Explore pathways matched to your healthcare field and find a good next step.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('discover')}
                    className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 font-semibold text-white transition-colors hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    Explore Pathways
                    <TrendingUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>

            {enrolledPaths.length === 0 && (
              <section aria-labelledby="suggested-pathways-title" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="suggested-pathways-title" className="text-base font-semibold text-foreground">Suggested pathways</h3>
                  {learningPaths.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('discover')}
                      className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                      View all
                    </button>
                  )}
                </div>
                {learningPaths.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {learningPaths.slice(0, 3).map(path => <PathCard key={`suggested-${path.id}`} {...cardProps(path)} />)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {profileHealthcareField
                      ? `New ${healthcareFieldLabel(profileHealthcareField)} pathways will appear here as they become available.`
                      : 'Add a healthcare field to your profile to see suggested pathways here.'}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : activeTab === 'recommended' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Recommended for You</h2>
              <span className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {relevantRecommendedPaths.length} pathways
              </span>
            </div>
            {relevantRecommendedPaths.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {relevantRecommendedPaths.map(path => <PathCard key={`rec-${path.id}`} {...cardProps(path)} />)}
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No recommendations yet"
                body="Keep learning and we’ll surface pathways that fit your healthcare field."
              />
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                {searchTerm ? 'Search results' : 'Discover pathways'}
              </h2>
              <span className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {learningPaths.length} pathways
              </span>
            </div>
            {learningPaths.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {learningPaths.map(path => <PathCard key={path.id} {...cardProps(path)} />)}
              </div>
            ) : (
              <EmptyState
                icon={searchTerm ? AlertCircle : Search}
                title={searchTerm ? 'No matching pathways' : profileHealthcareField ? 'No pathways in your field yet' : 'Find a pathway that fits'}
                body={
                  searchTerm
                    ? `We couldn't find pathways matching "${searchTerm}". Try another search.`
                    : profileHealthcareField
                      ? `There are no published pathways for ${healthcareFieldLabel(profileHealthcareField)} right now. Search to explore other fields.`
                      : 'Search by specialty, topic, or pathway name to explore the catalog.'
                }
              />
            )}
          </section>
        )}

      </div>
    </div>
  );
};

export default LearningPathInterface;