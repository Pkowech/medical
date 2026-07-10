'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import Link from 'next/link';
import { Prerequisites } from '@/shared/types/courseInterface';
import { apiService } from '@/features/auth/services/apiClient';

interface PrerequisitesCheckerProps {
  courseId: string;
  onPrerequisitesMet?: (met: boolean) => void;
}

export function PrerequisitesChecker({ courseId, onPrerequisitesMet }: PrerequisitesCheckerProps) {
  const [prerequisites, setPrerequisites] = useState<Prerequisites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  interface UserEnrollment { courseId: string; status?: string }
  const [userEnrollments, setUserEnrollments] = useState<UserEnrollment[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const loadPrerequisites = async () => {
    try {
      const response = await apiService.get<Prerequisites>(`/courses/${courseId}/prerequisites`);
      setPrerequisites(response.data);
    } catch (error) {
      console.error('Failed to load prerequisites:', error);
      setError('Failed to load prerequisites');
    }
  };

  const loadUserEnrollments = async () => {
    try {
      const response = await apiService.get<UserEnrollment[]>('/courses/my-courses');
      setUserEnrollments(response.data);
    } catch (error) {
      console.error('Failed to load user enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) {
      toast.error('Please provide a reason for overriding prerequisites');
      return;
    }

    try {
      setSubmittingOverride(true);
      await apiService.post(`/courses/${courseId}/override`, {
        reason: overrideReason,
      });
      
      toast.success('Prerequisites overridden. Proceed with caution.');
      setIsOverriding(false);
      onPrerequisitesMet?.(true); // Manually trigger met state
    } catch (error) {
      console.error('Failed to override prerequisites:', error);
      toast.error('Failed to override prerequisites');
    } finally {
      setSubmittingOverride(false);
    }
  };

  useEffect(() => {
    loadPrerequisites();
    loadUserEnrollments();
  }, [courseId]);

  const checkCourseCompletion = (courseId: string): boolean => {
    return userEnrollments.some(
      enrollment => enrollment.courseId === courseId && enrollment.status === 'completed'
    );
  };

  const getPrerequisiteStatus = () => {
    if (!prerequisites) return { met: false, total: 0, completed: 0 };

    const coursePrereqs = prerequisites?.courseIds || [];
    const completedPrereqs = coursePrereqs.filter(id => checkCourseCompletion(id));

    return {
      met: coursePrereqs.length === 0 || completedPrereqs.length === coursePrereqs.length,
      total: coursePrereqs.length,
      completed: completedPrereqs.length,
    };
  };

  useEffect(() => {
    if (prerequisites && userEnrollments.length > 0) {
      const status = getPrerequisiteStatus();
      onPrerequisitesMet?.(status.met);
    }
  }, [prerequisites, userEnrollments, onPrerequisitesMet]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (
    !prerequisites ||
    ((prerequisites.courseIds?.length || 0) === 0 && (prerequisites.skills?.length || 0) === 0)
  ) {
    return (
      <Card className="border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-600">
            <Unlock className="h-5 w-5" />
            <span>No prerequisites required for this course</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = getPrerequisiteStatus();

  return (
    <Card className={`${status.met ? 'border-green-200' : 'border-yellow-200'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.met ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Lock className="h-5 w-5 text-yellow-500" />
          )}
          Prerequisites
          <Badge variant={status.met ? 'default' : 'secondary'} className="ml-auto">
            {status.completed}/{status.total} completed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {prerequisites.description && (
          <p className="text-sm text-gray-600">{prerequisites.description}</p>
        )}

        {/* Course Prerequisites */}
        {(prerequisites.courseIds?.length || 0) > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Required Courses</h4>
            <div className="space-y-2">
              {prerequisites.prerequisiteCourses.map(course => {
                const isCompleted = checkCourseCompletion(course.id);
                return (
                  <div
                    key={course.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{course.title}</p>
                        <p className="text-sm text-gray-500">{course.code}</p>
                      </div>
                    </div>
                    {!isCompleted && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/courses/${course.id}`}>
                          View Course <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skill Prerequisites */}
        {(prerequisites.skills?.length || 0) > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {prerequisites.skills.map((skill, index) => (
                <Badge key={index} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Status Message */}
        <div
          className={`p-3 rounded-lg ${
            status.met
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {status.met ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700 font-medium">
                  All prerequisites met! You can enroll in this course.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-yellow-700 font-medium">
                  Complete the required courses above before enrolling.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Override Option */}
        {!status.met && (
          <div className="flex justify-end pt-2">
            <Dialog open={isOverriding} onOpenChange={setIsOverriding}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-amber-600 text-[10px] uppercase tracking-widest font-bold">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  Override Requirements
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bypass Prerequisites?</DialogTitle>
                  <DialogDescription>
                    We recommend completing the required courses first for the best learning outcomes. 
                    If you choose to proceed, your instructor will be notified of this override.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Why are you overriding these requirements?</label>
                    <Textarea 
                      placeholder="e.g., I have already covered this content in another program..." 
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOverriding(false)}>Go Back</Button>
                  <Button variant="destructive" onClick={handleOverride} disabled={submittingOverride}>
                    {submittingOverride ? 'Overriding...' : 'Override & Proceed'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
