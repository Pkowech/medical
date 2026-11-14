'use client';

import Link from 'next/link';
import { useEffect } from 'react';
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

export default function InstructorQuizAuthoringPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
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
            <p className="mt-2 text-xs text-muted-foreground">Build and reuse instructor-reviewed assessment items.</p>
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
            <p className="mt-2 text-xs text-muted-foreground">Align questions to topics, units, objectives, and difficulty levels.</p>
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
            <p className="mt-2 text-xs text-muted-foreground">Prepare assessment content for moderator and admin review before publication.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <BulkQuestionImport onImported={() => undefined} />
        <QuestionBankBrowser />
      </div>
    </div>
  );
}
