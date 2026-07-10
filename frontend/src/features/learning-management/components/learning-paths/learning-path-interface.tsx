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
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/features/auth/services/apiClient';
import { LearningPath, LearningPathProgress } from '@/shared/types';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';



interface InlineStatCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
}

const StatCard: React.FC<InlineStatCardProps> = ({ icon: Icon, title, value, subtitle, accent = 'text-indigo-500' }) => (
  <div className="relative flex flex-col gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 overflow-hidden group hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
    {/* faint corner accent */}
    <div className={cn('absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 dark:opacity-20', accent.replace('text-', 'bg-'))} />
    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', accent.replace('text-', 'bg-') + '/10 dark:' + accent.replace('text-', 'bg-') + '/20')}>
      <Icon className={cn('w-4 h-4', accent)} strokeWidth={1.75} />
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5">{title}</p>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

/* ─────────────────────────────── Difficulty Badge ─────────────────────── */
const difficultyMap: Record<string, { label: string; className: string }> = {
  beginner:     { label: 'Beginner',     className: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20' },
  intermediate: { label: 'Intermediate', className: 'bg-amber-50  dark:bg-amber-500/10  text-amber-700  dark:text-amber-400  ring-1 ring-amber-200  dark:ring-amber-500/20'  },
  advanced:     { label: 'Advanced',     className: 'bg-rose-50   dark:bg-rose-500/10   text-rose-700   dark:text-rose-400   ring-1 ring-rose-200   dark:ring-rose-500/20'   },
  expert:       { label: 'Expert',       className: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-500/20' },
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const d = difficultyMap[difficulty?.toLowerCase()] ?? { label: difficulty || 'All Levels', className: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 ring-1 ring-neutral-200 dark:ring-neutral-700' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider', d.className)}>
      <Activity className="w-2.5 h-2.5" />
      {d.label}
    </span>
  );
};

/* ─────────────────────────────── Progress Bar ──────────────────────────── */
const ProgressBar: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
  <div className={cn('h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden', className)}>
    <div
      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 dynamic-width"
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
  const rating = (path as any).analytics?.userRatings?.average ?? 0;
  const enrollments = (path as any).analytics?.totalEnrollments ?? 0;
  const weeks = (path as any).estimatedDurationWeeks ?? 0;

  return (
    <div
      onClick={() => onNavigate(path.id)}
      className="group relative flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 h-full"
    >
      {/* ── Header strip ── */}
      <div className="relative h-32 bg-neutral-950 dark:bg-neutral-950 p-5 flex flex-col justify-between overflow-hidden shrink-0">
        {/* subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04] grid-pattern text-white" />
        {/* glow blob */}
        <div className={cn(
          'absolute top-0 right-0 w-48 h-48 -mr-20 -mt-20 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700',
          (path.difficulty === 'advanced' || path.difficulty === 'expert') ? 'bg-rose-500' : 'bg-indigo-500'
        )} />

        <div className="relative flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-white/10 text-white/70 ring-1 ring-white/10">
              Path
            </span>
            {(path as any).specialization && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-amber-400 text-amber-950">
                <Target className="w-2 h-2" />
                {(path as any).specialization}
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
        <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">{path.description}</p>

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
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest">
              <span className="text-neutral-400 dark:text-neutral-500">Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400">{pct}%</span>
            </div>
            <ProgressBar value={pct} />
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
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
                  className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Courses
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onSchedule(); }}
                  className="flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
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
const SectionHeader: React.FC<{ icon: React.ElementType; iconClass: string; title: string; children?: React.ReactNode }> = ({ icon: Icon, iconClass, title, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <h2 className="flex items-center gap-2.5 text-xl font-bold text-neutral-900 dark:text-white">
      <Icon className={cn('w-5 h-5', iconClass)} strokeWidth={1.75} />
      {title}
    </h2>
    {children}
  </div>
);

/* ─────────────────────────────── Empty State ───────────────────────────── */
const EmptyState: React.FC<{ icon: React.ElementType; title: string; body: string }> = ({ icon: Icon, title, body }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/30">
    <Icon className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mb-3" strokeWidth={1.25} />
    <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">{title}</p>
    <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1 max-w-xs">{body}</p>
  </div>
);

/* ─────────────────────────────── Main Component ───────────────────────── */
export const LearningPathInterface: React.FC = () => {
  const { setHeader } = usePageHeader();
  const router = useRouter();
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [recommendedPaths, setRecommendedPaths] = useState<LearningPath[]>([]);
  const [userProgress, setUserProgress] = useState<LearningPathProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ searchTerm: '', difficulty: '', status: 'all', category: '', specialization: '' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const specParam = params.get('specialization');
    if (specParam) setFilters(prev => ({ ...prev, specialization: specParam }));
    setHeader({ title: 'Learning Paths', description: 'Master your medical career with structured curriculums', icon: '📚' });
    return () => setHeader(null);
  }, [setHeader]);

  useEffect(() => { fetchData(); }, [filters]);

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

  const normalizeLearningPath = (raw: any): LearningPath => ({
    id: raw.id,
    title: raw.title || '',
    description: raw.description || raw.desc || '',
    category: raw.category || raw.categoryId || '',
    difficulty: raw.difficulty || '',
    status: raw.status || '',
    estimatedDurationWeeks: raw.estimatedDurationWeeks || raw.estimated_duration_weeks || 0,
    estimatedHoursPerWeek: raw.estimatedHoursPerWeek || raw.estimated_hours_per_week || 0,
    tags: raw.tags || [],
    learningObjectives: raw.learningObjectives || raw.learning_objectives || [],
    analytics: {
      totalEnrollments: raw.analytics?.totalEnrollments || raw.analytics?.total_enrollments || 0,
      completionRate: raw.analytics?.completionRate || raw.analytics?.completion_rate || 0,
      userRatings: { average: raw.analytics?.userRatings?.average || raw.analytics?.user_ratings?.average || 0, count: raw.analytics?.userRatings?.count || raw.analytics?.user_ratings?.count || 0 },
    },
    createdBy: { id: raw.createdBy?.id || raw.created_by?.id || '', firstName: raw.createdBy?.firstName || raw.created_by?.first_name || '', lastName: raw.createdBy?.lastName || raw.created_by?.last_name || '' },
    courses: raw.courses || [],
    milestones: raw.milestones || [],
    specialization: raw.specialization,
  } as any);

  const fetchLearningPaths = async () => {
    try {
      const q = new URLSearchParams();
      if (filters.searchTerm) q.append('search', filters.searchTerm);
      if (filters.difficulty) q.append('difficulty', filters.difficulty);
      if (filters.category) q.append('category', filters.category);
      if (filters.specialization) q.append('specialization', filters.specialization);
      q.append('status', 'published');
      const res = await api.get<any>(`/learning-paths?${q}`);
      const raw = res.data?.data || res.data?.learningPaths || (Array.isArray(res.data) ? res.data : []);
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
          const path = normalizeLearningPath(p.learningPath || (p as any).learning_path);
          return {
            id: p.id || '',
            overallProgressPercentage: p.overallProgressPercentage || (p as any).overall_progress_percentage || 0,
            status: p.status || '',
            startedAt: p.startedAt || (p as any).started_at || new Date().toISOString(),
            lastAccessedAt: p.lastAccessedAt || (p as any).last_accessed_at || new Date().toISOString(),
            learningPath: path,
            milestonesAchieved: p.milestonesAchieved || (p as any).milestones_achieved || [],
            currentPhaseIndex: p.currentPhaseIndex ?? (p as any).current_phase_index ?? 0,
            currentModuleIndex: p.currentModuleIndex ?? (p as any).current_module_index ?? 0,
            phaseProgress: (p.phaseProgress || (p as any).phase_progress || []).map((pp: any) => ({
              phaseId: pp.phaseId || pp.phase_id,
              status: pp.status || 'notStarted',
              progressPercentage: pp.progressPercentage || pp.progress_percentage || 0,
              modulesCompleted: pp.modulesCompleted || pp.modules_completed || []
            })),
            moduleProgress: (p.moduleProgress || (p as any).module_progress || []).map((mp: any) => ({
              moduleId: mp.moduleId || mp.module_id,
              phaseId: mp.phaseId || mp.phase_id,
              status: mp.status || 'notStarted',
              progressPercentage: mp.progressPercentage || mp.progress_percentage || 0,
              timeSpentMinutes: mp.timeSpentMinutes || mp.time_spent_minutes || 0
            }))
          } as LearningPathProgress;
        }));
      } else {
        setUserProgress([]);
      }
    } catch (err) {
      console.error(err);
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
    } catch (err: any) {
      console.error('Enrollment error:', err);
      const message = err.response?.data?.message || err.message || 'Failed to enroll in learning path.';
      toast.error(message);
    }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchLearningPaths(); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-neutral-400 dark:text-neutral-500 font-medium tracking-wide">Loading paths…</p>
        </div>
      </div>
    );
  }

  const enrolledPaths = userProgress.map(p => ({ ...p.learningPath, isEnrolled: true, progress: p })).filter(Boolean);
  const inProgress = userProgress.filter(p => p.status === 'inProgress').length;
  const completed  = userProgress.filter(p => p.status === 'completed').length;

  const cardProps = (path: any) => ({
    path,
    isEnrolled: path.isEnrolled,
    progress: path.progress,
    onEnroll: enrollInPath,
    onNavigate: (id: string) => router.push(`/learning-paths/${id}`),
    onSchedule: () => router.push('/study-planner/schedule'),
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-4 md:px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BookOpen}     title="Active Paths" value={inProgress}    subtitle="Currently enrolled"   accent="text-indigo-500" />
          <StatCard icon={CheckCircle}  title="Completed"    value={completed}     subtitle="Paths finished"        accent="text-emerald-500" />
          <StatCard icon={TrendingUp}   title="In Progress"  value={inProgress}    subtitle="Keep going"            accent="text-violet-500" />
          <StatCard icon={Sparkles}     title="Avg Score"    value="88%"           subtitle="Across all paths"      accent="text-amber-500" />
        </div>

        {/* ── Active Pathways ── */}
        <section className="space-y-5">
          <SectionHeader icon={BookOpen} iconClass="text-indigo-500" title="Active Pathways" />
          {enrolledPaths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {enrolledPaths.map((p: any) => <PathCard key={`enrolled-${p.id}`} {...cardProps(p)} />)}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No active paths yet"
              body="Browse the catalog below to start your first specialization."
            />
          )}
        </section>

        <hr className="border-neutral-100 dark:border-neutral-800" />

        {/* ── Recommended ── */}
        {recommendedPaths.length > 0 && (
          <>
            <section className="space-y-5">
              <SectionHeader icon={Sparkles} iconClass="text-amber-500" title="Recommended for You" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {recommendedPaths.map(p => <PathCard key={`rec-${p.id}`} {...cardProps(p as any)} />)}
              </div>
            </section>
            <hr className="border-neutral-100 dark:border-neutral-800" />
          </>
        )}

        {/* ── Discover ── */}
        <section className="space-y-5">
          <SectionHeader icon={TrendingUp} iconClass="text-blue-500" title="Discover Pathways">
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto sm:max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search paths…"
                  value={filters.searchTerm}
                  onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="w-full pl-9 pr-3 h-9 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Search
              </button>
            </form>
          </SectionHeader>

          {/* Difficulty filter */}
          <div className="flex flex-wrap gap-2">
            {['', 'beginner', 'intermediate', 'advanced', 'expert'].map(d => (
              <button
                key={d}
                onClick={() => setFilters({ ...filters, difficulty: d })}
                className={cn(
                  'px-3.5 h-8 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors',
                  filters.difficulty === d
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                )}
              >
                {d || 'All Levels'}
              </button>
            ))}
          </div>

          {learningPaths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {learningPaths.map(p => <PathCard key={p.id} {...cardProps(p as any)} />)}
            </div>
          ) : (
            <EmptyState
              icon={AlertCircle}
              title="No paths found"
              body="Try adjusting your filters or search terms."
            />
          )}
        </section>

      </div>
    </div>
  );
};

export default LearningPathInterface;