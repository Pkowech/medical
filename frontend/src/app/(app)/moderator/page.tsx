'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FileWarning, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Role } from '@/shared/enums/role.enum';

interface QuestionFlag {
  id: string;
  issueType: string;
  description: string | null;
  createdAt: string;
}

interface FlaggedQuestion {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  isActive: boolean;
  updatedAt: string;
  course: { id: string; title: string } | null;
  unit: { id: string; title: string } | null;
  flags: QuestionFlag[];
  flagCount: number;
}

export default function ModeratorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const canModerate = allRoles.includes(Role.moderator) || allRoles.includes(Role.admin);
  const [questions, setQuestions] = useState<FlaggedQuestion[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!canModerate) router.replace('/unauthorized');
  }, [canModerate, isAuthenticated, isLoading, router]);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const response = await apiService.get<FlaggedQuestion[]>('/question-flags/moderation-queue');
      setQuestions(response.data);
    } catch (cause) {
      console.error('Failed to load flagged-question moderation queue', cause);
      setError(cause instanceof Error ? cause.message : 'The moderation queue could not be loaded.');
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !canModerate) return;
    void loadQueue();
  }, [canModerate, isAuthenticated, loadQueue, refreshVersion]);

  useEffect(() => {
    setHeader({
      title: 'Moderator dashboard',
      description: 'Review assessment questions reported by learners.',
      actions: (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRefreshVersion(version => version + 1)}
          disabled={loadingQueue}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loadingQueue ? 'animate-spin' : ''}`} />
          Refresh queue
        </Button>
      ),
    });
    return () => setHeader(null);
  }, [loadingQueue, setHeader]);

  const stats = useMemo(() => {
    const reportCount = questions.reduce((total, question) => total + question.flagCount, 0);
    const inactiveCount = questions.filter(question => !question.isActive).length;
    return [
      { title: 'Flagged questions', value: loadingQueue ? '—' : String(questions.length), detail: 'Questions with learner reports', icon: FileWarning, tone: 'text-amber-600' },
      { title: 'Learner reports', value: loadingQueue ? '—' : String(reportCount), detail: 'Reports across the loaded queue', icon: AlertTriangle, tone: 'text-red-600' },
      { title: 'Inactive questions', value: loadingQueue ? '—' : String(inactiveCount), detail: 'Currently excluded from use', icon: CheckCircle2, tone: 'text-emerald-600' },
    ];
  }, [loadingQueue, questions]);

  if (isLoading || !isAuthenticated || !canModerate || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Assessment quality review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review learner-reported questions and their reasons. The current report model is read-only; it does not yet track moderator decisions or resolved status.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map(({ title, value, detail, icon: Icon, tone }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`rounded-lg bg-muted p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported questions</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setRefreshVersion(version => version + 1)}>Retry</Button>
            </div>
          ) : loadingQueue ? (
            <p className="py-6 text-center text-sm text-muted-foreground" role="status">Loading reports…</p>
          ) : questions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No assessment questions have been reported.</p>
          ) : (
            <ul className="divide-y divide-border">
              {questions.map(question => (
                <li key={question.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{question.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[question.course?.title, question.unit?.title, question.category, question.difficulty]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={question.isActive ? 'secondary' : 'outline'}>
                        {question.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="destructive">{question.flagCount} report{question.flagCount === 1 ? '' : 's'}</Badge>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
                    {question.flags.map(flag => (
                      <li key={flag.id} className="text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium capitalize">{flag.issueType.replaceAll('_', ' ')}</span>
                          <time className="text-xs text-muted-foreground" dateTime={flag.createdAt}>
                            {new Date(flag.createdAt).toLocaleString()}
                          </time>
                        </div>
                        {flag.description && <p className="mt-1 text-muted-foreground">{flag.description}</p>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
