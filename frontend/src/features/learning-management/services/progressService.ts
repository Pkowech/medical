import api from '../../auth/services/apiClient';
import type {
  ProgressData,
  ProgressStats,
  ProgressActivity,
  CourseProgress,
  Deadline,
  Achievement,
  PeerComparison,
  FlashcardCard,
  UnknownRecord,
  RawActivity,
  RawCourseProgress,
  QuizScores,
  StudySessionSummary,
  StudyStatistics,
  LearningPathProgressSummary,
  UnitProgressSummary,
  RecommendedPathSummary,
  ExtendedProgressStats,
} from '@/shared/types/progressInterface';
import { toast } from 'sonner';

/**
 * Format error for logging - handles various error types
 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    let cause = '';
    const typedError = error as Error & { cause?: unknown };
    if (typedError.cause != null) {
      if (typedError.cause instanceof Error) {
        cause = typedError.cause.message;
      } else if (typeof typedError.cause === 'string') {
        cause = typedError.cause;
      } else if (typeof typedError.cause === 'number' || typeof typedError.cause === 'boolean') {
        cause = String(typedError.cause);
      } else {
        try {
          cause = JSON.stringify(typedError.cause);
        } catch {
          cause = '[object]';
        }
      }
    }
    return `${error.message}${cause ? ` (${cause})` : ''}`;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    // Check for Axios error structure
    if (err.response) {
      const response = err.response as Record<string, unknown>;
      const statusVal = response.status;
      const status = typeof statusVal === 'number' || typeof statusVal === 'string' ? String(statusVal) : 'unknown';
      const data = response.data as Record<string, unknown> || {};
      const messageVal = data.message ?? data.error;
      const message = typeof messageVal === 'string' ? messageVal : 'API Error';
      return `HTTP ${status}: ${message}`;
    }
    if (err.message) {
      const msg = err.message;
      if (typeof msg === 'string') {
        return msg;
      } else if (typeof msg === 'number' || typeof msg === 'boolean') {
        return String(msg);
      } else {
        try {
          return JSON.stringify(msg);
        } catch {
          return '[object]';
        }
      }
    }
    if (err.code) {
      const codeVal = err.code;
      const code = typeof codeVal === 'string' || typeof codeVal === 'number' ? String(codeVal) : 'unknown';
      const msgVal = err.message;
      const msg = typeof msgVal === 'string' ? msgVal : 'Network error';
      return `Error ${code}: ${msg}`;
    }
    // Try to stringify the error object
    try {
      return JSON.stringify(error);
    } catch {
      return '[object Object]';
    }
  }
  return typeof error === 'string' ? error : '[object Object]';
};


/**
 * Get current client timestamp for offline conflict resolution
 * Returns milliseconds since epoch (matches backend lastUpdated field)
 */
const getClientTimestamp = (): number => Date.now();

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;

const generateId = (): string => `${Math.random().toString(36).slice(2)}${Date.now()}`;

interface DashboardApiResponse {
  overview?: UnknownRecord;
  courses?: RawCourseProgress[];
  activities?: RawActivity[];
  achievements?: Achievement[];
  peerComparison?: PeerComparison;
  deadlines?: UnknownRecord[];
  dueReviews?: UnknownRecord[];
  enrolledUnits?: UnknownRecord[];
}

const progressService = {
  async getProgressStats(userId: string): Promise<ProgressStats> {
    try {
      const response = await api.get<ProgressStats>(`/progress/overview/${userId}`);
      return response.data as ProgressStats;
    } catch (error) {
      console.error('Error fetching progress stats:', formatError(error));

      // Return placeholder data if API fails
      return {
        overallProgress: 48,
        coursesCompleted: 7,
        totalCourses: 15,
        streak: 12,
        lastActivity: new Date().toISOString(),
      };
    }
  },

  async getUserProgress(userId: string): Promise<UnknownRecord[]> {
    try {
      const response = await api.get<UnknownRecord[]>(`/progress/user-progress/${userId}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching user progress:', formatError(error));
      throw error;
    }
  },

  async getCourseProgress(userId: string): Promise<CourseProgress[]> {
    try {
      const response = await api.get<CourseProgress[]>(`/progress/courses/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching course progress:', formatError(error));
      return []; // Return empty array on error
    }
  },

  async getRecentActivities(): Promise<ProgressActivity[]> {
    try {
      const response = await api.get<RawActivity[]>('/progress/activities');
      const raw = response.data;
      const normalize = (item: RawActivity): ProgressActivity => {
        // Accept multiple backend shapes and normalize to the frontend ProgressActivity type
        const date =
          asString(item.date, '') ||
          asString(item.createdAt, '') ||
          asString(item.timestamp, '') ||
          new Date().toISOString();
        const title =
          asString(item.title, '') ||
          asString(item.name, '') ||
          asString(item.description, '') ||
          'Activity';
        const type = asString(item.type, '') || asString(item.kind, '') || 'activity';
        // duration might be in minutes or seconds or nested
        let durationMinutes: number | undefined = undefined;
        if (typeof item.durationMinutes === 'number') durationMinutes = item.durationMinutes;
        else if (typeof item.duration === 'number') durationMinutes = item.duration;
        else {
          const session = asRecord(item.session);
          const metadata = asRecord(item.metadata);
          const sessionDuration = session ? asNumber(session.duration) : undefined;
          const metadataDuration = metadata ? asNumber(metadata.duration) : undefined;
          durationMinutes = sessionDuration ?? metadataDuration;
        }
        // if duration looks like seconds and large, try normalize to minutes
        if (typeof durationMinutes === 'number' && durationMinutes > 1000) {
          durationMinutes = Math.round(durationMinutes / 60);
        }

        let score: number | undefined = undefined;
        if (typeof item.score === 'number') score = item.score;
        else {
          const session = asRecord(item.session);
          const metadata = asRecord(item.metadata);
          const sessionScore = session ? asNumber(session.score) : undefined;
          const metadataScore = metadata ? asNumber(metadata.score) : undefined;
          score = sessionScore ?? metadataScore;
        }

        return {
          id: asString(item.id, '') || asString(item._id, '') || generateId(),
          type,
          title,
          date,
          durationMinutes,
          score,
        } as ProgressActivity;
      };

      return Array.isArray(raw) ? raw.map(normalize) : [];
    } catch (error) {
      console.error('Error fetching recent activities:', error);

      // Return placeholder data if API fails
      return [
        {
          id: '1',
          type: 'course',
          title: 'Completed quiz in Physiology Fundamentals',
          date: new Date().toISOString(),
          durationMinutes: 30,
          score: 88,
        },
        {
          id: '2',
          type: 'material',
          title: 'Downloaded Anatomy Lecture Notes',
          date: new Date(Date.now() - 3600000).toISOString(),
          durationMinutes: 10,
        },
      ];
    }
  },

  async getAchievements(): Promise<Achievement[]> {
    try {
      const response = await api.get<Achievement[]>('/progress/achievements');
      return response.data as Achievement[];
    } catch (error) {
      console.error('Error fetching achievements:', error);

      // Return placeholder data if API fails
      return [
        {
          id: '1',
          title: 'Fast Learner',
          description: 'Completed 5 courses',
          icon: 'trophy',
          dateEarned: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
        {
          id: '2',
          title: 'Consistent Student',
          description: 'Maintained a 10-day streak',
          icon: 'calendar',
          dateEarned: new Date().toISOString(),
        },
      ];
    }
  },

  async getAllProgressData(userId: string): Promise<ProgressData> {
    try {
      // Fetch aggregated data + mastery data in parallel (2 requests instead of 8)
      // Use allSettled to ensure that even if one endpoint (e.g. gRPC-backed mastery) fails,
      // the dashboard can still render with the remaining data.
      const [progressResult, masteryResult] = await Promise.allSettled([
         api.get<DashboardApiResponse>(`/progress/dashboard/${userId}`),
         api.get<Record<string, number>>(`/blueprint/mastery/${userId}`),
      ]);
      
      const dashboardRes = progressResult.status === 'fulfilled' ? progressResult.value : null;
      const masteryRes = masteryResult.status === 'fulfilled' ? masteryResult.value : null;

      const dashboardData = dashboardRes?.data || {} as DashboardApiResponse;
      const {
        overview: overviewRes,
        activities: activitiesRes,
        achievements: achievementsRes,
        peerComparison: peerRes,
        deadlines: deadlinesRes,
        dueReviews: dueReviewsRes,
        enrolledUnits: enrolledUnitsRes
      } = dashboardData;

      // Compatibility wrapping to match previous structure expectations (where each was an Axios response or null)
      // Actually, we can just extract the data directly since getDashboardData returns the *data* directly, not Axios responses.
      // Wait, `dashboardRes` IS an Axios response. `dashboardRes.data` contains the object associated.
      
      const overviewData = overviewRes;
      const activitiesData = activitiesRes;
      const achievementsData = achievementsRes;
      const peerData = peerRes;
      // streaksRes is the data
      const deadlinesData = deadlinesRes;
      const dueReviewsData = dueReviewsRes;

      // Normalize overview response
      let statsObj: UnknownRecord | null = null;
      if (overviewData) {
        const data = overviewData as UnknownRecord;
        if (data.stats && typeof data.stats === 'object') {
          statsObj = data.stats as UnknownRecord;
        } else {
          statsObj = data;
        }
      }

      const stats: ExtendedProgressStats = statsObj
        ? (statsObj as unknown as ExtendedProgressStats)
        : {
            overallProgress: 0,
            coursesCompleted: 0,
            totalCourses: 0,
            streak: 0,
            lastActivity: null,
          };
      // Support different streak field names returned by backend
      const statsRecord = stats as unknown as UnknownRecord;
      stats.streak = stats.streak ?? (statsRecord['streakDays'] as number | undefined) ?? (statsRecord['currentStreak'] as number | undefined) ?? 0;
      
      const enrolledUnitsRaw: UnknownRecord[] = Array.isArray(enrolledUnitsRes) ? (enrolledUnitsRes as UnknownRecord[]) : [];
      const recentActivities = Array.isArray(activitiesData) ? (activitiesData as ProgressActivity[]) : [];
      const achievements = Array.isArray(achievementsData) ? (achievementsData as Achievement[]) : [];
      const dueReviews = Array.isArray(dueReviewsData) ? (dueReviewsData as UnknownRecord[]) : [];
      const mastery = masteryRes?.data || {};
      const deadlines = Array.isArray(deadlinesData) ? (deadlinesData as UnknownRecord[]) : [];


      // Map progressTrends to performanceTrends
      interface RawTrend { date?: string; type?: string; value?: number | string }
      const rawTrends = ((stats as unknown) as Record<string, unknown>)['progressTrends'] as RawTrend[] | undefined || [];
      const performanceTrends: { month: string; score: number; hours: number }[] = [];
      const monthlyData: Record<string, { totalScore: number, scoreCount: number, totalHours: number }> = {};
      
      rawTrends.forEach((trend) => {
        if (!trend || !trend.date) return;
        const date = new Date(trend.date);
        const month = date.toLocaleString('default', { month: 'short' });
        
        if (!monthlyData[month]) {
          monthlyData[month] = { totalScore: 0, scoreCount: 0, totalHours: 0 };
        }
        
        // Aggregate based on trend type
        const type = String(trend.type || '').toLowerCase();
        if (['score', 'assessment', 'average_score'].includes(type)) {
          monthlyData[month].totalScore += Number(trend.value || 0);
          monthlyData[month].scoreCount++;
        } else if (['hours', 'study_time', 'study_duration'].includes(type)) {
          monthlyData[month].totalHours += Number(trend.value || 0);
        }
      });
      
      Object.entries(monthlyData).forEach(([month, data]) => {
        performanceTrends.push({
          month,
          score: data.scoreCount > 0 ? Math.round(data.totalScore / data.scoreCount) : 0,
          hours: Math.round(data.totalHours / 60 * 10) / 10 // Assuming value is in minutes, convert to hours
        });
      });

      // Calculate average mastery from p_known values
      const masteryValues = Object.values(mastery) as number[];
      const averageMastery = masteryValues.length > 0
        ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length * 100
        : stats.averageScore || 0;

      const result: ProgressData = {
        overallProgress: stats.overallProgress || 0,
        stats: {
          overallProgress: stats.overallProgress || 0,
          coursesCompleted: stats.coursesCompleted || 0,
          totalCourses: stats.totalCourses || 0,
          averageScore: Math.round(averageMastery),
          streak: stats.streak || 0,
          lastActivity: stats.lastActivity || new Date().toISOString(),
        },
        coursesCompleted: stats.coursesCompleted || 0,
        totalCourses: stats.totalCourses || 0,
        streak: stats.streak || 0,
        lastActivity: stats.lastActivity || null,
        courseProgress: enrolledUnitsRaw.map(cp => ({
          id: asString(cp.courseId, '') || generateId(),
          unitId: asString(cp.unitId, ''),
          title: asString(cp.unitTitle, '') || asString(cp.courseTitle, '') || 'Untitled Unit',
          progressPercentage:
            (typeof cp.progressPercentage === 'number' ? cp.progressPercentage : undefined) ??
            0,
          completed: cp.progressPercentage === 100,
          nextTopicId: asString(cp.nextTopicId, '') || undefined,
        })),
        recentActivities: Array.isArray(recentActivities) ? (recentActivities as unknown as ProgressActivity[]) : [],
        recentActivity: [],
        achievements: Array.isArray(achievements) ? achievements : [],
        upcomingDeadlines: Array.isArray(deadlines) ? deadlines.map((d: UnknownRecord) => {
          const courseObj = d.course as UnknownRecord | undefined;
          let courseTitle = 'General';
          if (courseObj && typeof courseObj === 'object' && 'title' in courseObj) {
            const title = courseObj.title;
            courseTitle = typeof title === 'string' ? title : 'General';
          }
          
          const dueDateVal = d.dueDate;
          const dueDate = typeof dueDateVal === 'string' ? dueDateVal : '';
          
          const priorityVal = d.priority;
          let priorityStr: 'medium' | 'high' | 'low' = 'medium';
          if (typeof priorityVal === 'string') {
            const normalized = priorityVal.toLowerCase();
            if (normalized === 'high' || normalized === 'low') {
              priorityStr = normalized;
            }
          }
          
          const idVal = d.id;
          const id = typeof idVal === 'string' ? idVal : '';

          const courseIdVal = d.courseId;
          const courseId = typeof courseIdVal === 'string' ? courseIdVal : undefined;
          
          const titleVal = d.title;
          const title = typeof titleVal === 'string' ? titleVal : '';
          
          const typeVal = d.type;
          let type: 'exam' | 'assignment' | 'quiz' | 'goal' | 'schedule' = 'assignment';
          if (typeof typeVal === 'string') {
            const normalized = typeVal.toLowerCase();
            if (['exam', 'assignment', 'quiz', 'goal', 'schedule'].includes(normalized)) {
              type = normalized as 'exam' | 'assignment' | 'quiz' | 'goal' | 'schedule';
            } else if (normalized === 'deadline') {
              type = 'assignment';
            }
          }
          
          return {
            id,
            courseId,
            title,
            course: courseTitle,
            date: dueDate,
            daysLeft: dueDate ? Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
            priority: priorityStr,
            type,
          } as Deadline;
        }) : [],
        weeklyProgress: Array(7).fill(0).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            day: d.toLocaleString('default', { weekday: 'short' }),
            hours: 0,
            target: 4
          };
        }),
        studyGroups: [],
        flashcards: {
          due: dueReviews.length,
          mastered: masteryValues.filter(m => m > 0.9).length, // Heuristic for mastered concepts
          learning: masteryValues.filter(m => m > 0 && m <= 0.9).length,
          decks: [], // Decks would need another endpoint or mapping
          stats: { accuracy: 0, sessions: 0, avgTimePerCard: '0s' },
          cards: Array.isArray(dueReviews) ? (dueReviews as unknown as FlashcardCard[]) : [],
        },

        performanceTrends,
        recommendedStudy: [],
        peerComparison: peerData || {
          yourAverage: 0,
          cohortAverage: 0,
          topPerformer: 0,
          rank: 0,
          totalStudents: 0,
        },
        aiInsights: [],
      };
      
      // Map courseData to the computed courseProgress array to feed the Dashboard
      const courseProgressList: CourseProgress[] = result.courseProgress || [];
      result.courseData = courseProgressList.map((cp, idx) => {
         const colors = [
          'from-blue-500 to-indigo-600',
          'from-emerald-500 to-teal-600',
          'from-rose-500 to-red-600',
          'from-purple-500 to-fuchsia-600'
         ];
         return {
           id: cp.id,
           unitId: cp.unitId,
           nextTopicId: cp.nextTopicId,
           name: cp.title,
           progressPercentage: cp.progressPercentage,
           color: colors[idx % colors.length] || 'from-gray-500 to-slate-600',
           nextTopic: 'Continue Learning',
           timeLeft: 'N/A'
         };
      });

      return result;
    } catch (error) {
      console.error('Error fetching all progress data:', error);
      toast.error('Failed to load progress data.');
      throw error;
    }
  },

  async updateUnitProgress(
    unitId: string,
    status: 'notStarted' | 'inProgress' | 'completed' | 'failed',
    completionPercentage?: number,
    timeSpentMinutes?: number,
    notes?: string,
    quizScores?: QuizScores
  ): Promise<void> {
    try {
      // Use the unified sync endpoint which accepts unit/material/topic updates
      await api.post<void>('/progress/sync', {
        unitId,
        status,
        progressPercentage: completionPercentage,
        timeSpentMinutes,
        notes,
        quizScores,
      }, {
        headers: {
          'X-Client-Timestamp': `${getClientTimestamp()}`, // Milliseconds for conflict resolution
        },
      });
    } catch (error) {
      // Handle 409 Conflict - server has newer data (offline sync handled by sync service)
      if (((error as { response?: { status?: number } })?.response?.status) === 409) {
        console.warn('Conflict detected: server has newer progress data, skipping update');
        return; // Non-fatal - let sync queue handle it
      }
      console.error('Error updating unit progress:', formatError(error));
      throw error;
    }
  },


  /**
   * Get study sessions for user
   */
  async getStudySessions(
    userId: string,
    options?: { courseId?: string; period?: string }
  ): Promise<StudySessionSummary[]> {
    try {
      const params = new URLSearchParams();
      if (options?.courseId) params.append('courseId', options.courseId);
      if (options?.period) params.append('period', options.period);

      const response = await api.get<StudySessionSummary[]>(`/study/sessions?${params.toString()}`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching study sessions:', formatError(error));
      return [];
    }
  },

  /**
   * Get study statistics
   */
  async getStudyStatistics(period: 'week' | 'month' | 'year' = 'month'): Promise<StudyStatistics> {
    try {
      const response = await api.get<StudyStatistics>(
        `/study/data/summary?period=${period}`
      );
      return response.data || {};
    } catch (error) {
      console.error('Error fetching study statistics:', error);
      return {};
    }
  },

  /**
   * Get learning path progress
   */
  async getLearningPathProgress(_userId: string): Promise<LearningPathProgressSummary[]> {
    try {
      const response = await api.get<LearningPathProgressSummary[]>(
        `/learning-paths/my-progress`
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching learning path progress:', formatError(error));
      return [];
    }
  },

  /**
   * Get unit progress
   */
  async getUnitProgress(userId: string, courseId?: string): Promise<UnitProgressSummary[]> {
    try {
      const response = await api.get<{ courseProgress?: UnitProgressSummary[] }>(
        `/progress/overview/${userId}`
      );
      // The backend returns the raw progress data inside courseProgress for this endpoint
      let progressList = response.data?.courseProgress || [];
      
      // If courseId is passed, filter the list
      if (courseId) {
        progressList = progressList.filter(p => p.courseId === courseId);
      }
      
      return Array.isArray(progressList) ? progressList : [];
    } catch (error) {
      console.error('Error fetching unit progress:', formatError(error));
      return [];
    }
  },

  /**
   * Get peer comparison and analytics
   */
  async getPeerComparison(userId: string): Promise<PeerComparison> {
    try {
      const response = await api.get<PeerComparison>(`/progress/peer-comparison/${userId}`);
      return (
        response.data || {
          yourAverage: 0,
          cohortAverage: 0,
          topPerformer: 0,
          rank: 0,
          totalStudents: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching peer comparison:', formatError(error));
      return { yourAverage: 0, cohortAverage: 0, topPerformer: 0, rank: 0, totalStudents: 0 };
    }
  },

  /**
   * Sync course progress with learning path
   */
  async syncCourseProgress(
    courseId: string,
    progressData: { percentage: number; completedItems: number; totalItems: number }
  ): Promise<void> {
    try {
      await api.post('/learning/progress', {
        courseId,
        progress: progressData.percentage,
        timeSpent: 0,
        metadata: progressData,
      }, {
        headers: {
          'X-Client-Timestamp': `${getClientTimestamp()}`,
        },
      });
    } catch (error) {
      // Handle 409 Conflict - server has newer data
      if (((error as { response?: { status?: number } })?.response?.status) === 409) {
        console.warn('Conflict detected in course sync: server has newer data');
        return; // Non-fatal
      }
      console.error('Error syncing course progress:', error);
      // Non-critical - don't throw
    }
  },

  /**
   * Get user streak information
   */
  async getUserStreaks(userId: string): Promise<{ userId: string; currentStreak: number; longestStreak: number; lastActivityDate: string | null }> {
    try {
      const response = await api.get(`/progress/streaks/${userId}`);
      return response.data as { userId: string; currentStreak: number; longestStreak: number; lastActivityDate: string | null };
    } catch (error) {
      console.error('Error fetching user streaks:', error);
      // Return default/placeholder streak data
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
      };
    }
  },

  /**
   * Get recommended learning paths
   */
  async getRecommendedPaths(limit: number = 5): Promise<RecommendedPathSummary[]> {
    try {
      const response = await api.get<RecommendedPathSummary[]>(
        `/learning-paths/recommendations?limit=${limit}`
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error fetching recommended paths:', formatError(error));
      return [];
    }
  },

  /**
   * Compute a local fallback streak from recent activities
   */
  computeLocalStreak(activities?: ProgressActivity[]): number {
    if (!activities || activities.length === 0) return 0;

    const daySet = new Set<string>();
    activities.forEach((a) => {
      const dStr = a.date;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      daySet.add(d.toDateString());
    });

    if (daySet.size === 0) return 0;

    let streakCount = 0;
    const today = new Date();
    for (let i = 0; ; i++) {
      const check = new Date(today);
      check.setDate(today.getDate() - i);
      const key = check.toDateString();
      if (daySet.has(key)) {
        streakCount++;
      } else {
        break;
      }
      if (streakCount > 365) break;
    }

    return streakCount;
  },

  /**
   * Fetches the complete enriched progress data for a user
   */
  async getEnrichedProgressData(userId: string): Promise<ProgressData> {
    // Basic aggregated data which already calls the dashboard endpoint
    const progressData = await this.getAllProgressData(userId);

    // Compute central streak
    const backendStreak = (progressData.stats as ProgressStats)?.streak ?? 0;
    const recentActivities = progressData.recentActivities ?? [];
    const localStreak = this.computeLocalStreak(recentActivities);
    const finalStreak = backendStreak || localStreak || 0;

    const weeklyProgress = Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);
      
      const daySessions = recentActivities.filter((s: ProgressActivity) => {
        if (!s.date) return false;
        const sd = new Date(s.date);
        return sd >= startOfDay && sd <= endOfDay;
      });
      
      const durationMinutes = daySessions.reduce(
        (acc: number, s: ProgressActivity) => acc + (s.durationMinutes || 0),
        0
      );
      const hours = Math.round((durationMinutes / 60) * 10) / 10;
      
      return {
        day: d.toLocaleString('default', { weekday: 'short' }),
        hours,
        target: 4
      };
    });

    const enriched: ProgressData = {
      ...progressData,
      stats: {
        ...(progressData.stats as object),
        streak: finalStreak,
      } as ProgressStats,
      streak: finalStreak,
      studySessions: [], // Replaced by recentActivities logic
      weeklyProgress,
      featuredSpecializations: [], // Fetched dynamically where needed
      pathProgress: [],
      unitProgress: [],
      peerComparison: progressData.peerComparison,
      recommendedStudy: progressData.recommendedStudy || [],
    };

    return enriched;
  },
};

export default progressService;
