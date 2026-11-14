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
import { Textarea } from '@/shared/components/ui/textarea';
import { Role } from '@/shared/enums/role.enum';

type ModerationStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';
type QueueFilter = 'active' | 'all' | ModerationStatus;

interface QuestionFlag {
  id: string;
  issueType: string;
  description: string | null;
  createdAt: string;
}

interface ModerationEvent {
  id: string;
  action: string;
  fromStatus: ModerationStatus | null;
  toStatus: ModerationStatus;
  reason: string | null;
  createdAt: string;
  actor: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface QuestionModerationCase {
  id: string;
  questionId: string;
  status: ModerationStatus;
  resolution: string | null;
  resolutionNote: string | null;
  openedAt: string;
  closedAt: string | null;
  assignedModerator: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  events: ModerationEvent[];
  question: {
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
  };
}

const QUEUE_FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'active', label: 'Active cases' },
  { value: 'all', label: 'All cases' },
  { value: 'open', label: 'Open' },
  { value: 'in_review', label: 'In review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

const RESOLUTIONS = [
  { value: 'no_issue_found', label: 'No issue found' },
  { value: 'instructor_action_required', label: 'Instructor action required' },
  { value: 'content_corrected', label: 'Content corrected' },
  { value: 'question_withdrawn', label: 'Question withdrawn' },
];

export default function ModeratorDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const canModerate = allRoles.includes(Role.moderator) || allRoles.includes(Role.admin);
  const [cases, setCases] = useState<QuestionModerationCase[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('active');
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorCaseId, setActionErrorCaseId] = useState<string | null>(null);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
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
      const status = filter === 'active' ? '' : `?status=${filter}`;
      const response = await apiService.get<QuestionModerationCase[]>(
        `/question-flags/moderation-queue${status}`,
      );
      setCases(response.data);
    } catch (cause) {
      console.error('Failed to load question moderation queue', cause);
      setError(cause instanceof Error ? cause.message : 'The moderation queue could not be loaded.');
    } finally {
      setLoadingQueue(false);
    }
  }, [filter]);

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

  const runCaseAction = async (
    moderationCase: QuestionModerationCase,
    action: 'claim' | 'resolve' | 'dismiss',
  ) => {
    setActionCaseId(moderationCase.id);
    setActionError(null);
    setActionErrorCaseId(null);
    try {
      if (action === 'claim') {
        await apiService.patch(
          `/question-flags/${moderationCase.questionId}/claim`,
          {},
        );
      } else {
        const reason = reasons[moderationCase.id]?.trim() ?? '';
        if (reason.length < 3) {
          setActionError('Add a decision reason of at least 3 characters.');
          setActionErrorCaseId(moderationCase.id);
          return;
        }
        await apiService.patch(`/question-flags/${moderationCase.questionId}/decision`, {
          status: action === 'resolve' ? 'resolved' : 'dismissed',
          resolution: action === 'resolve' ? resolutions[moderationCase.id] : undefined,
          reason,
        });
        setReasons(current => ({ ...current, [moderationCase.id]: '' }));
      }

      await loadQueue();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'The moderation action could not be saved.',
      );
      setActionErrorCaseId(moderationCase.id);
    } finally {
      setActionCaseId(null);
    }
  };

  const stats = useMemo(() => {
    const reportCount = cases.reduce((total, item) => total + item.question.flagCount, 0);
    const reviewCount = cases.filter(item => item.status === 'in_review').length;
    return [
      { title: 'Cases loaded', value: loadingQueue ? '—' : String(cases.length), detail: 'Cases matching the selected filter', icon: FileWarning, tone: 'text-amber-600' },
      { title: 'Learner reports', value: loadingQueue ? '—' : String(reportCount), detail: 'Reports attached to these cases', icon: AlertTriangle, tone: 'text-red-600' },
      { title: 'In review', value: loadingQueue ? '—' : String(reviewCount), detail: 'Cases currently claimed by a moderator', icon: CheckCircle2, tone: 'text-emerald-600' },
    ];
  }, [cases, loadingQueue]);

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
            Claim reports to record a decision. A new learner report reopens a previously closed case.
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
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Question moderation cases</CardTitle>
          <label className="text-sm">
            <span className="sr-only">Filter cases</span>
            <select
              className="rounded-md border border-input bg-background px-3 py-2"
              value={filter}
              onChange={event => setFilter(event.target.value as QueueFilter)}
            >
              {QUEUE_FILTERS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => setRefreshVersion(version => version + 1)}>Retry</Button>
            </div>
          ) : loadingQueue ? (
            <p className="py-6 text-center text-sm text-muted-foreground" role="status">Loading reports...</p>
          ) : cases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No cases match this filter.</p>
          ) : (
            <ul className="divide-y divide-border">
              {cases.map(moderationCase => {
                const question = moderationCase.question;
                const isAssignedToUser = moderationCase.assignedModerator?.id === user.id;
                const isBusy = actionCaseId === moderationCase.id;
                const resolution = resolutions[moderationCase.id] ?? 'instructor_action_required';

                return (
                  <li key={moderationCase.id} className="space-y-4 py-5 first:pt-0 last:pb-0">
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
                        <Badge variant={moderationCase.status === 'resolved' ? 'secondary' : 'outline'}>
                          {moderationCase.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="destructive">
                          {question.flagCount} report{question.flagCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </div>

                    <ul className="space-y-2 rounded-md bg-muted/40 p-3">
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

                    {moderationCase.status === 'open' && (
                      <Button
                        size="sm"
                        onClick={() => void runCaseAction(moderationCase, 'claim')}
                        disabled={isBusy}
                      >
                        {isBusy ? 'Claiming...' : 'Claim case'}
                      </Button>
                    )}
                    {moderationCase.status === 'in_review' && (
                      <div className="space-y-3 rounded-md border border-border p-3">
                        {isAssignedToUser ? (
                          <>
                            <label className="block space-y-1 text-sm">
                              <span className="font-medium">Resolution</span>
                              <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                                value={resolution}
                                onChange={event => setResolutions(current => ({
                                  ...current,
                                  [moderationCase.id]: event.target.value,
                                }))}
                              >
                                {RESOLUTIONS.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block space-y-1 text-sm">
                              <span className="font-medium">Decision reason</span>
                              <Textarea
                                value={reasons[moderationCase.id] ?? ''}
                                onChange={event => setReasons(current => ({
                                  ...current,
                                  [moderationCase.id]: event.target.value,
                                }))}
                                maxLength={2000}
                                rows={3}
                                placeholder="Record the evidence reviewed and why you chose this outcome."
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => void runCaseAction(moderationCase, 'resolve')}
                                disabled={isBusy || (reasons[moderationCase.id]?.trim().length ?? 0) < 3}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void runCaseAction(moderationCase, 'dismiss')}
                                disabled={isBusy || (reasons[moderationCase.id]?.trim().length ?? 0) < 3}
                              >
                                Dismiss report
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Assigned to {moderationCase.assignedModerator?.firstName || moderationCase.assignedModerator?.email || 'another moderator'}.
                          </p>
                        )}
                      </div>
                    )}
                    {moderationCase.resolutionNote && (
                      <p className="rounded-md border border-border p-3 text-sm">
                        <span className="font-medium">
                          Decision{moderationCase.resolution ? ` (${moderationCase.resolution.replaceAll('_', ' ')})` : ''}:
                        </span>
                        {' '}{moderationCase.resolutionNote}
                      </p>
                    )}
                    {actionError && actionErrorCaseId === moderationCase.id && (
                      <p className="text-sm text-destructive" role="alert">{actionError}</p>
                    )}

                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Decision history</summary>
                      <ol className="mt-2 space-y-2 border-l border-border pl-4">
                        {moderationCase.events.map(event => (
                          <li key={event.id} className="text-xs text-muted-foreground">
                            <p>
                              <span className="font-medium text-foreground">{event.action.replace('_', ' ')}</span>
                              {' · '}
                              {event.actor
                                ? `${event.actor.firstName ?? ''} ${event.actor.lastName ?? ''}`.trim() || 'User'
                                : 'System'}
                              {' · '}
                              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                            </p>
                            {event.reason && <p className="mt-1">{event.reason}</p>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
