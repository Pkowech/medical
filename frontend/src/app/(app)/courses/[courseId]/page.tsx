import { EducationalCourseLayout } from '@/features/courses/components/EducationalCourseLayout';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: PageProps) {
  const { courseId } = await params;
  
  return (
    <ProtectedRoute>
      <EducationalCourseLayout courseId={courseId} />
    </ProtectedRoute>
  );
}
