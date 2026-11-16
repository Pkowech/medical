'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FileUp, ListChecks } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { BulkQuestionImport } from '@/features/assessment/components/BulkQuestionImport';
import { QuestionBankBrowser } from '@/features/assessment/components/QuestionBankBrowser';
import { Role } from '@/shared/enums/role.enum';
import apiService from '@/features/auth/services/apiClient';

type AuthoringQuiz = {
  id: string;
  title: string;
  description?: string | null;
  isPublished: boolean;
  questions: Array<{ questionId: string }>;
};

export default function InstructorQuizAuthoringPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [quizId, setQuizId] = useState('');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizPublished, setQuizPublished] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  const loadQuiz = async () => {
    const requestedId = quizId.trim();
    if (!requestedId) {
      setQuizError('Enter a quiz ID to load a draft.');
      return;
    }
    setIsLoadingQuiz(true);
    setQuizError(null);
    try {
      const response = await apiService.get<AuthoringQuiz>(
        `/quizzes/${encodeURIComponent(requestedId)}/authoring`
      );
      setEditingQuizId(response.data.id);
      setQuizTitle(response.data.title);
      setQuizDescription(response.data.description ?? '');
      setQuizPublished(response.data.isPublished);
      setSelectedQuestionIds(response.data.questions.map(question => question.questionId));
    } catch (cause) {
      setQuizError(cause instanceof Error ? cause.message : 'Quiz draft could not be loaded.');
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const saveQuiz = async () => {
    if (isSavingQuiz) return;
    if (!quizTitle.trim()) {
      setQuizError('Enter a quiz title.');
      return;
    }
    if (!selectedQuestionIds.length) {
      setQuizError('Select at least one question from the bank.');
      return;
    }
    setIsSavingQuiz(true);
    setQuizError(null);
    try {
      const payload = {
        title: quizTitle.trim(),
        description: quizDescription.trim() || undefined,
        questions: selectedQuestionIds,
      };
      const response = editingQuizId
        ? await apiService.patch<AuthoringQuiz>(`/quizzes/${editingQuizId}`, payload)
        : await apiService.post<AuthoringQuiz>('/quizzes', payload);
      setEditingQuizId(response.data.id);
      setQuizId(response.data.id);
      setQuizPublished(response.data.isPublished);
      setRefreshKey(value => value + 1);
    } catch (cause) {
      setQuizError(cause instanceof Error ? cause.message : 'Quiz could not be saved.');
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const publishQuiz = async () => {
    if (!editingQuizId || quizPublished || isSavingQuiz) return;
    setIsSavingQuiz(true);
    setQuizError(null);
    try {
      await apiService.post(`/quizzes/${editingQuizId}/publish`);
      setQuizPublished(true);
      setRefreshKey(value => value + 1);
    } catch (cause) {
      setQuizError(cause instanceof Error ? cause.message : 'Quiz could not be published.');
    } finally {
      setIsSavingQuiz(false);
    }
  };
  const canAuthor = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!canAuthor) {
      router.replace('/unauthorized');
    }
  }, [canAuthor, isAuthenticated, isLoading, router]);

  useEffect(() => {
    setHeader({
      title: 'Quiz authoring',
      description: 'Create, curate, review, and publish assessment content for your curriculum.',
      actions: (
        <Button asChild size="sm" variant="outline">
          <Link href="/instructor/content">Course and topic authoring</Link>
        </Button>
      ),
    });
    return () => setHeader(null);
  }, [setHeader]);

  if (isLoading || !isAuthenticated || !canAuthor || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="space-y-6 p-1">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ListChecks className="h-4 w-4 text-primary" /> Question bank
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">Reusable</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Build and reuse instructor-reviewed assessment items.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" /> Curriculum mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">Linked</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Align questions to topics, units, objectives, and difficulty levels.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileUp className="h-4 w-4 text-primary" /> Review workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">Governed</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Prepare assessment content for moderator and admin review before publication.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <BulkQuestionImport onImported={() => setRefreshKey(value => value + 1)} />
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">Create or edit a quiz</h2>
            <p className="text-sm text-muted-foreground">
              Select reusable questions, save a draft, then publish it for learners. Quizzes with
              attempts are locked against edits.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Quiz title
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={quizTitle}
                onChange={event => setQuizTitle(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Existing quiz ID (optional)
              <span className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 font-normal"
                  value={quizId}
                  onChange={event => setQuizId(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoadingQuiz}
                  onClick={() => void loadQuiz()}
                >
                  {isLoadingQuiz ? 'Loading…' : 'Load'}
                </Button>
              </span>
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Description
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              rows={2}
              value={quizDescription}
              onChange={event => setQuizDescription(event.target.value)}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            {selectedQuestionIds.length} question{selectedQuestionIds.length === 1 ? '' : 's'}{' '}
            selected.
            {editingQuizId && ` Draft ID: ${editingQuizId}.`}
            {editingQuizId && ` Status: ${quizPublished ? 'published' : 'draft'}.`}
          </p>
          {quizError && (
            <p role="alert" className="text-sm text-destructive">
              {quizError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isSavingQuiz || quizPublished}
              onClick={() => void saveQuiz()}
            >
              {isSavingQuiz ? 'Saving…' : editingQuizId ? 'Save changes' : 'Create draft'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!editingQuizId || quizPublished || isSavingQuiz}
              onClick={() => void publishQuiz()}
            >
              {quizPublished ? 'Published' : 'Publish for learners'}
            </Button>
          </div>
        </section>
        <QuestionBankBrowser
          refreshKey={refreshKey}
          selectable
          selectedQuestionIds={selectedQuestionIds}
          onSelectionChange={setSelectedQuestionIds}
        />
      </div>
    </div>
  );
}
