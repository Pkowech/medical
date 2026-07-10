'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { apiService } from '@/features/auth/services/apiClient';
import {
  BookOpen,
  Clock,
  Users,
  Star,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getInstructorDisplayName } from '@/lib/utils';
import { Course } from '@/shared/types/courseInterface';

interface CourseDiscoveryProps {
  userId?: string;
}

export function CourseDiscovery({ userId }: CourseDiscoveryProps) {
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [recommendedCourses, setRecommendedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiscoveryCourses();
  }, [userId]);

  const loadDiscoveryCourses = async () => {
    try {
      setLoading(true);

      const promises = [apiService.get('/courses/featured?limit=6')];
      if (userId) {
        promises.push(apiService.get('/courses/recommended?limit=6'));
      }

      const [featuredResponse, recommendedResponse] = await Promise.all(promises);

      if (featuredResponse?.data) {
        setFeaturedCourses(featuredResponse.data as Course[]);
      }

      if (recommendedResponse?.data) {
        setRecommendedCourses(recommendedResponse.data as Course[]);
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      console.error('Failed to load discovery courses:', err);
      toast.error('Failed to load course recommendations');
    } finally {
      setLoading(false);
    }
  };

  const enrollInCourse = async (courseId: string) => {
    try {
      await apiService.post(`/courses/${courseId}/enroll`);
      toast.success('Successfully enrolled in course!');
      loadDiscoveryCourses(); // Refresh courses
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Enrollment error:', err?.message ?? error);
      toast.error(err?.message ?? 'Failed to enroll in course');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const CourseCard = ({
    course,
    showEnrollButton = true,
  }: {
    course: Course;
    showEnrollButton?: boolean;
  }) => (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {course.code}
              </Badge>
              <Badge className={getDifficultyColor(course.difficulty)}>{course.difficulty}</Badge>
              {course.category && (
                <Badge
                  variant="outline"
                  style={{ borderColor: course.category.color, color: course.category.color }}
                >
                  {course.category.name}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
            {course.instructor && (
              <p className="text-sm text-gray-600 mt-1">
                by {getInstructorDisplayName(course.instructor)}
              </p>
            )}
          </div>
          {course.isEnrolled && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">{course.description}</p>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {course.estimatedHours}h
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {course.enrollmentCount}
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {course.rating?.toFixed(1)} ({course.ratingCount})
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/courses/${course.id}`}>
              <BookOpen className="h-4 w-4 mr-2" />
              View Course
            </Link>
          </Button>
          {showEnrollButton && !course.isEnrolled && (
            <Button variant="outline" onClick={() => enrollInCourse(course.id)} className="flex-1">
              Enroll
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Featured Courses */}
      {featuredCourses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-gray-900">Featured Courses</h2>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/courses?featured=true">
                View All <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCourses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended Courses */}
      {recommendedCourses.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-900">Recommended for You</h2>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/courses">
                View All <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedCourses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {featuredCourses.length === 0 && recommendedCourses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses available</h3>
          <p className="text-gray-600">Check back later for new course recommendations.</p>
        </div>
      )}
    </div>
  );
}
