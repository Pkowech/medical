import { CourseOverview } from '@/features/courses/components/CourseOverview';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { resolveRouteParams } from '@/shared/types/nextPageProps';

type PageProps = {
  params: Promise<{ courseId: string }> | { courseId: string };
};

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await resolveRouteParams(params);

  return (
    <ProtectedRoute>
      <CourseOverview />
    </ProtectedRoute>
  );
}
