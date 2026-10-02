import { CourseOverview } from '@/features/courses/components/CourseOverview';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params;
  
  return (
    <ProtectedRoute>
      <CourseOverview />
    </ProtectedRoute>
  );
}
