import { CourseOverview } from '@/features/courses/components/CourseOverview';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
export default function CoursePage() {
  return (
    <ProtectedRoute>
      <CourseOverview />
    </ProtectedRoute>
  );
}
