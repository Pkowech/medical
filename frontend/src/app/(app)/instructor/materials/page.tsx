'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Library, Upload } from 'lucide-react';
import FileUpload from '@/shared/components/forms/FileUpload';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { courseService } from '@/features/courses/services/courseService';
import { materialService } from '@/features/courses/services/materialService';
import { MaterialLibraryPicker } from '@/features/materials/components/MaterialLibraryPicker';
import type { Course, CourseUnit, Topic } from '@/shared/types/courseInterface';
import type { Material } from '@/shared/types/materialInterface';
import { Role } from '@/shared/enums/role.enum';

const NO_SELECTION = 'none';

export default function InstructorMaterialsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { allRoles } = usePermissions();
  const { setHeader } = usePageHeader();
  const canManageMaterials = allRoles.includes(Role.instructor) || allRoles.includes(Role.admin);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState(NO_SELECTION);
  const [selectedTopicId, setSelectedTopicId] = useState(NO_SELECTION);
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/login');
    else if (!canManageMaterials) router.replace('/unauthorized');
  }, [canManageMaterials, isAuthenticated, isLoading, router]);

  useEffect(() => {
    setHeader({
      title: 'Instructor materials',
      description: 'Upload or reuse learning resources and place them in your course curriculum.',
      actions: (
        <Button asChild size="sm" variant="outline">
          <Link href="/instructor/content">Course authoring</Link>
        </Button>
      ),
    });
    return () => setHeader(null);
  }, [setHeader]);

  useEffect(() => {
    if (!user?.id || !canManageMaterials) return;
    let active = true;
    setLoadingCourses(true);
    setError(null);
    void courseService.getCourses({ page: 1, limit: 100, instructorId: user.id })
      .then(result => {
        if (active) setCourses(result.items ?? []);
      })
      .catch(cause => {
        console.error('Failed to load instructor courses for material placement', cause);
        if (active) setError(cause instanceof Error ? cause.message : 'Your courses could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadingCourses(false);
      });
    return () => {
      active = false;
    };
  }, [canManageMaterials, refreshVersion, user?.id]);

  const loadCourse = useCallback(async (courseId: string) => {
    setSelectedCourse(null);
    setSelectedUnitId(NO_SELECTION);
    setSelectedTopicId(NO_SELECTION);
    if (courseId === NO_SELECTION) return;
    setLoadingCourseDetails(true);
    setError(null);
    try {
      setSelectedCourse(await courseService.getCourseById(courseId));
    } catch (cause) {
      console.error('Failed to load course curriculum for material placement', cause);
      setError(cause instanceof Error ? cause.message : 'The selected course structure could not be loaded.');
    } finally {
      setLoadingCourseDetails(false);
    }
  }, []);

  const units = useMemo(() => selectedCourse?.units ?? [], [selectedCourse]);
  const selectedUnit = units.find(unit => String(unit.id) === selectedUnitId);
  const topics = selectedUnit?.topics ?? [];

  const attachFromLibrary = async (
    material: Material,
    context: { topicId?: string; unitId?: string; courseId?: string; title: string },
  ) => {
    if (!context.courseId) throw new Error('Choose a course before attaching a material.');
    await materialService.attachMaterial({
      sourceMaterialId: material.id,
      title: context.title,
      courseId: context.courseId,
      unitId: context.unitId,
      topicId: context.topicId,
      shareWithCourse: sharingEnabled,
    });
    setRefreshVersion(version => version + 1);
  };

  if (isLoading || !isAuthenticated || !canManageMaterials || !user?.id) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-1">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            Choose placement
          </CardTitle>
          <CardDescription>
            Materials must belong to a course. Unit and topic placement are optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="material-course" className="text-sm font-medium">Course</label>
            <Select value={selectedCourse?.id ?? NO_SELECTION} onValueChange={value => void loadCourse(value)}>
              <SelectTrigger id="material-course"><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>Select a course</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>{course.title || course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="material-unit" className="text-sm font-medium">Unit (optional)</label>
            <Select
              value={selectedUnitId}
              onValueChange={value => {
                setSelectedUnitId(value);
                setSelectedTopicId(NO_SELECTION);
              }}
            >
              <SelectTrigger id="material-unit" disabled={!selectedCourse || loadingCourseDetails}>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>Course-level</SelectItem>
                {units.map((unit: CourseUnit) => (
                  <SelectItem key={unit.id} value={String(unit.id)}>{unit.title || unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="material-topic" className="text-sm font-medium">Topic (optional)</label>
            <Select
              value={selectedTopicId}
              onValueChange={setSelectedTopicId}
            >
              <SelectTrigger id="material-topic" disabled={!selectedUnit}>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SELECTION}>Unit-level</SelectItem>
                {topics.map((topic: Topic) => (
                  <SelectItem key={topic.id} value={topic.id}>{topic.title || topic.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!loadingCourses && courses.length === 0 && !error && (
        <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Create or get assigned to a course before adding course materials.
        </p>
      )}

      {selectedCourse && (
        <>
          <div className="flex items-start gap-2">
            <Checkbox
              id="material-share-with-course"
              checked={sharingEnabled}
              onCheckedChange={checked => setSharingEnabled(checked === true)}
            />
            <label htmlFor="material-share-with-course" className="text-sm leading-5">
              Share with enrolled learners
              <span className="block text-xs text-muted-foreground">
                You can keep a resource private while preparing it.
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4 text-primary" /> Upload a new resource
                </CardTitle>
                <CardDescription>Uploaded file will use the selected curriculum placement.</CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  courseId={selectedCourse.id}
                  unitId={selectedUnitId === NO_SELECTION ? undefined : selectedUnitId}
                  topicId={selectedTopicId === NO_SELECTION ? undefined : selectedTopicId}
                  shareWithCourse={sharingEnabled}
                  onUploadComplete={() => setRefreshVersion(version => version + 1)}
                  maxFileSizeMB={50}
                  allowedFileTypes={['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.webm']}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Library className="h-4 w-4 text-primary" /> Reuse a library resource
                </CardTitle>
                <CardDescription>Attach an existing file without uploading its bytes again.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" onClick={() => setShowLibraryPicker(true)}>
                  Browse materials library
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {showLibraryPicker && selectedCourse && (
        <MaterialLibraryPicker
          courseId={selectedCourse.id}
          unitId={selectedUnitId === NO_SELECTION ? undefined : selectedUnitId}
          topicId={selectedTopicId === NO_SELECTION ? undefined : selectedTopicId}
          onClose={() => setShowLibraryPicker(false)}
          onAttach={attachFromLibrary}
        />
      )}
    </div>
  );
}
