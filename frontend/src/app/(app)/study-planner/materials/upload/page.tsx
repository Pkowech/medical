'use client';

import React, { useState, useEffect } from 'react';
import materialService from '@/features/courses/services/materialService';
import { courseService } from '@/features/courses/services/courseService';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Course, CourseEnrollment, CourseUnit, Lesson, Topic } from '@/shared/types/courseInterface';
import { ArrowLeft, FileUp, FolderOpen, HardDrive, Link2 } from 'lucide-react';
import DriveFolderImport from '@/features/materials/components/DriveFolderImport';
import { usePermissions } from '@/features/auth/hooks/usePermissions';
import { Role } from '@/shared/enums/role.enum';

type ExtendedUnit = CourseUnit & { lessons?: Lesson[] };
type ExtendedCourse = Course & { chapters?: ExtendedUnit[] };
type TopicItem = { id: string | number; title: string };

export default function UploadMaterialPage() {
  const router = useRouter();
  const { allRoles } = usePermissions();
  const canManagePlatformLibrary = allRoles.some(
    role => role === Role.instructor || role === Role.admin,
  );
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'upload' | 'drive' | 'folder'>('drive');
  const [driveUrl, setDriveUrl] = useState('');
  const [shareWithCourse, setShareWithCourse] = useState(false);
  
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [topicId, setTopicId] = useState('');

  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<ExtendedUnit[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState('');
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [unitLoadError, setUnitLoadError] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  const [isCheckingDriveConnection, setIsCheckingDriveConnection] = useState(true);

  useEffect(() => {
    setSource(canManagePlatformLibrary ? 'upload' : 'drive');
    if (!canManagePlatformLibrary) {
      setSelectedCourseId('');
      setUnitId('');
      setTopicId('');
      setShareWithCourse(false);
    }
  }, [canManagePlatformLibrary]);

  const [type, setType] = useState('pdf');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ];
  const EXTENSION_MIME_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp4: 'video/mp4',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
  };

  const isAllowedMaterialFile = (selectedFile: File) => {
    const normalizedType = selectedFile.type.toLowerCase();
    if (ALLOWED_TYPES.includes(normalizedType)) {
      return true;
    }

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!extension) {
      return false;
    }

    return ALLOWED_TYPES.includes(EXTENSION_MIME_TYPES[extension] ?? '');
  };

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const publishedCourses = await courseService.getPublishedCourses({ page: 1, limit: 100 });
        if (canManagePlatformLibrary) {
          setCourses(publishedCourses.items || []);
        } else {
          const [active, completed] = await Promise.all([
            courseService.getEnrolledCourses({ status: 'active', page: 1, limit: 100 }),
            courseService.getEnrolledCourses({ status: 'completed', page: 1, limit: 100 }),
          ]);
          const enrolledCourseIds = new Set(
            [...active.items, ...completed.items]
              .filter((enrollment: CourseEnrollment) =>
                enrollment.status === 'active' || enrollment.status === 'completed',
              )
              .map(enrollment => enrollment.courseId),
          );
          setCourses((publishedCourses.items || []).filter(course => enrolledCourseIds.has(course.id)));
        }
      } catch (err) {
        console.warn('Failed to load courses for upload form', err);
        setCourseLoadError('Courses could not be loaded. A course is required to place this material.');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    void loadCourses();
  }, [canManagePlatformLibrary]);

  useEffect(() => {
    let cancelled = false;
    materialService.getGoogleDriveConnectionStatus()
      .then(status => {
        if (!cancelled) setDriveConnected(status.connected);
      })
      .catch(err => {
        console.warn('Could not check personal Google Drive connection', err);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingDriveConnection(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('driveConnected') === '1') {
      setSource('folder');
      toast.success('Personal Google Drive connected.');
      router.replace('/study-planner/materials/upload', { scroll: false });
    } else if (params.get('driveError')) {
      setSource('folder');
      toast.error('Google Drive connection was not completed.');
      router.replace('/study-planner/materials/upload', { scroll: false });
    }
  }, [router]);

  const handleConnectDrive = async () => {
    try {
      const authorizationUrl = await materialService.getGoogleDriveAuthorizationUrl();
      window.location.assign(authorizationUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start Google Drive connection.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setUnitId('');
    setTopicId('');
    setUnits([]);
    setTopics([]);
    setUnitLoadError('');

    if (!selectedCourseId) {
      setIsLoadingUnits(false);
      return () => {
        cancelled = true;
      };
    }

    const loadUnits = async () => {
      try {
        setIsLoadingUnits(true);
        const course = await courseService.getCourseById(selectedCourseId);
        const courseWithChapters = course as ExtendedCourse;
        const loadedUnits = course.units || courseWithChapters.chapters || [];
        if (!cancelled) setUnits(loadedUnits);
      } catch (err) {
        console.warn('Failed to load units for course', selectedCourseId, err);
        if (!cancelled) {
          setUnitLoadError('Units could not be loaded. Please try selecting the course again.');
        }
      } finally {
        if (!cancelled) setIsLoadingUnits(false);
      }
    };

    void loadUnits();
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  useEffect(() => {
    setTopicId('');
    setTopics([]);

    if (!unitId || units.length === 0) return;

    const selectedUnit = units.find(u => String(u.id) === unitId);
    if (selectedUnit) {
      const availableTopics = selectedUnit.lessons || selectedUnit.topics || [];
      setTopics(availableTopics.map((topic: Lesson | Topic) => ({
        id: topic.id,
        title: topic.title || String(topic.id),
      })));
    }
  }, [unitId, units]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const canAssignCourse = canManagePlatformLibrary || source === 'drive';
    if (source === 'folder') return;
    if (source === 'upload' && !canManagePlatformLibrary) {
      toast.error('Only instructors can upload files to the MedTrack library. Use Google Drive for personal files.');
      return;
    }
    if (!selectedCourseId) {
      toast.error('Choose a course to place this material.');
      return;
    }
    if (topicId && !unitId) {
      toast.error('Choose a unit before assigning a topic.');
      return;
    }
    if (canManagePlatformLibrary && shareWithCourse && !selectedCourseId) {
      toast.error('Choose a course before sharing with a class');
      return;
    }

    if (source === 'drive') {
      if (!driveUrl.trim()) {
        toast.error('Paste a Google Drive file URL');
        return;
      }
      try {
        setIsUploading(true);
        await materialService.registerGoogleDriveMaterial({
          url: driveUrl.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          courseId: selectedCourseId,
          unitId: canAssignCourse ? unitId : undefined,
          topicId: canAssignCourse ? topicId || undefined : undefined,
          shareWithCourse: canManagePlatformLibrary && shareWithCourse,
        });
        toast.success('Drive material linked.');
        router.push('/study-planner/materials');
      } catch (err) {
        console.error('Drive material registration failed', err);
        toast.error(err instanceof Error ? err.message : 'Could not link Drive material');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum allowed size is 50MB.');
      return;
    }

    if (!isAllowedMaterialFile(file)) {
      toast.error(
        'Unsupported file type. Choose a PDF, DOC, DOCX, PPT, PPTX, or supported video file.'
      );
      return;
    }

    const formData = new FormData();
    formData.append('file', file as Blob);
    formData.append('title', title.trim());
    formData.append('description', description);
    if (unitId) {
      formData.append('unitId', unitId);
    }
    if (selectedCourseId) {
      formData.append('courseId', selectedCourseId);
    }
    if (topicId) {
      formData.append('topicId', topicId);
    }
    formData.append('shareWithCourse', String(shareWithCourse));
    
    if (type) formData.append('type', type);

    try {
      setIsUploading(true);
      await materialService.uploadMaterial(formData, {
        onUploadProgress: e => {
          if (!e.lengthComputable || typeof e.total !== 'number') return;
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        },
      });
      toast.success('Material uploaded');
      router.push('/study-planner/materials');
    } catch (err) {
      console.error('Upload failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload material');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    if (!selectedFile) return;

    const filename = selectedFile.name.toLowerCase();
    const mimeType = selectedFile.type.toLowerCase();
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      setType('pdf');
    } else if (mimeType.startsWith('video/') || /\.(mp4|mpeg|mpg|mov|avi|webm)$/.test(filename)) {
      setType('video');
    } else if (
      mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      /\.(ppt|pptx)$/.test(filename)
    ) {
      setType('slide');
    } else {
      setType('notes');
    }

    if (!title.trim()) {
      setTitle(selectedFile.name.replace(/\.[^.]+$/, ''));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-1 py-6 sm:px-2 sm:py-8">
      <button
        type="button"
        onClick={() => router.push('/study-planner/materials')}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-blue-700 dark:text-muted-foreground dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to materials
      </button>
      <div className="mb-5">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Study library</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground dark:text-foreground">
          {canManagePlatformLibrary ? 'Add a study material' : 'Add personal study material'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
          Add a file or link, then place it in a course. Unit and topic placement can be added when relevant.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-7 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card sm:p-6" aria-label="Upload material form">
        <div>
          <span className="mb-2 block text-sm font-medium text-muted-foreground dark:text-muted-foreground">Material source</span>
          <div className="flex w-full flex-wrap gap-1 rounded-lg bg-muted p-1 dark:bg-card sm:w-fit" role="group" aria-label="Material source">
            {canManagePlatformLibrary && (
              <button
                type="button"
                aria-pressed={source === 'upload'}
                onClick={() => setSource('upload')}
                className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${source === 'upload' ? 'bg-card text-blue-700 shadow-sm dark:bg-secondary dark:text-blue-300' : 'text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'}`}
              >
                <FileUp className="h-4 w-4" /> Upload to library
              </button>
            )}
            <button
              type="button"
              aria-pressed={source === 'drive'}
              onClick={() => setSource('drive')}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${source === 'drive' ? 'bg-card text-blue-700 shadow-sm dark:bg-secondary dark:text-blue-300' : 'text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'}`}
            >
              <HardDrive className="h-4 w-4" /> Google Drive
            </button>
            <button
              type="button"
              aria-pressed={source === 'folder'}
              onClick={() => setSource('folder')}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${source === 'folder' ? 'bg-card text-blue-700 shadow-sm dark:bg-secondary dark:text-blue-300' : 'text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'}`}
            >
              <FolderOpen className="h-4 w-4" /> Import folder
            </button>
          </div>
        </div>

        {source === 'folder' ? (
          <DriveFolderImport
            courses={courses}
            isLoadingCourses={isLoadingCourses}
            allowCourseSharing={canManagePlatformLibrary}
          />
        ) : (
          <>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            required
            aria-required="true"
            placeholder="e.g. Introduction to Pharmacology"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            rows={4}
            placeholder="Brief description of the material..."
          />
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-background p-4 dark:border-border dark:bg-background/60 sm:p-5">
          <h3 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground">
            {canManagePlatformLibrary ? 'Placement' : source === 'drive' ? 'Private course assignment' : 'Personal storage'}
          </h3>
          
          {canManagePlatformLibrary || source === 'drive' ? (
            <>
          <div>
            <label htmlFor="course-select" className="mb-1.5 block text-sm font-medium text-muted-foreground dark:text-muted-foreground">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              id="course-select"
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              required
              disabled={isLoadingCourses || courses.length === 0}
              aria-busy={isLoadingCourses}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            >
              <option value="">Select a course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name}
                </option>
              ))}
            </select>
            {isLoadingCourses && (
              <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground" role="status">Loading available courses…</p>
            )}
            {courseLoadError && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" role="status">{courseLoadError}</p>
            )}
          </div>

          <div>
            <label htmlFor="unit-select" className="mb-1.5 block text-sm font-medium text-muted-foreground dark:text-muted-foreground">
              Unit <span className="text-muted-foreground">(optional; select to add topic placement)</span>
            </label>
            <select
              id="unit-select"
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              disabled={!selectedCourseId || isLoadingUnits || units.length === 0}
              aria-busy={isLoadingUnits}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            >
              <option value="">
                {isLoadingUnits ? 'Loading units…' : units.length === 0 && selectedCourseId ? 'No units found' : '-- Select a Unit --'}
              </option>
              {units.map(u => (
                <option key={u.id} value={String(u.id)}>
                  {u.title || String(u.id)}
                </option>
              ))}
            </select>
            {unitLoadError && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" role="alert">{unitLoadError}</p>
            )}
          </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
              Personal files stay in your Google Drive. MedTrack stores a private link only; uploading
              to the MedTrack library and sharing with classmates is reserved for instructors.
            </p>
          )}

          {source === 'drive' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {isCheckingDriveConnection
                  ? 'Checking personal Google Drive connection…'
                  : driveConnected
                    ? 'Personal Google Drive is connected with read-only access.'
                    : 'To link a file shared with your personal Google account, connect Drive first.'}
              </p>
              {!driveConnected && !isCheckingDriveConnection && (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  className="mt-2 rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/40"
                >
                  Connect personal Google Drive
                </button>
              )}
            </div>
          )}

          {(canManagePlatformLibrary || source === 'drive') && (
            <div>
            <label htmlFor="topic-select" className="mb-1.5 block text-sm font-medium text-muted-foreground dark:text-muted-foreground">
              Topic / Lesson (optional)
            </label>
            <select
              id="topic-select"
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              disabled={!unitId || topics.length === 0}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            >
              <option value="">{topics.length === 0 && unitId ? 'No topics found' : '-- Select a Topic --'}</option>
              {topics.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground dark:text-muted-foreground">
            {canManagePlatformLibrary
              ? 'A course is required. Leave the unit blank for course-level resources such as textbooks; select a unit to optionally place the material under a topic.'
              : 'Choose a course you are enrolled in to organize this personal Drive link. It remains private to you and is not shared with classmates.'}
            </p>
            </div>
          )}
          {canManagePlatformLibrary && <>
          <label className={`flex items-start gap-3 rounded-lg border p-3 ${selectedCourseId ? 'cursor-pointer border-blue-200 bg-card dark:border-blue-900 dark:bg-card' : 'cursor-not-allowed border-border opacity-60 dark:border-border'}`}>
            <input
              type="checkbox"
              checked={shareWithCourse}
              disabled={!selectedCourseId}
              onChange={(event) => setShareWithCourse(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-muted-foreground dark:text-muted-foreground">Share with enrolled class</span>
              <span className="mt-0.5 block text-xs text-muted-foreground dark:text-muted-foreground">
                Private by default. Students enrolled in this course can see it only when you turn sharing on.
              </span>
            </span>
          </label>
          </>}
          {!canManagePlatformLibrary && source === 'drive' && (
            <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
              Course assignment is for your own organization only. The Drive file stays in your account, and classmates cannot access this link through MedTrack.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {source === 'upload' && <div>
            <label htmlFor="type-select" className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">
              Material Type
            </label>
            <select
              id="type-select"
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
            >
              <option value="pdf">PDF Document</option>
              <option value="video">Video</option>
              <option value="slide">Presentation</option>
              <option value="notes">Word/Text Notes</option>
            </select>
          </div>}

          {source === 'upload' ? <div>
            <label className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">File <span className="text-red-500">*</span></label>
            <input
              type="file"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground dark:text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              aria-label="Select file to upload"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mpeg,.mpg,.mov,.avi,.webm"
              required
            />
            <div className="text-xs text-muted-foreground dark:text-muted-foreground mt-2">Max size: 50MB. Supported: PDF, DOC, PPT, and common video formats. Title and material type are suggested from the selected file.</div>
          </div> : <div>
            <label htmlFor="drive-url" className="block text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">
              Shared Drive file URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="drive-url"
                type="url"
                value={driveUrl}
                onChange={e => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-border dark:bg-background dark:text-foreground dark:focus:ring-blue-950"
                required={source === 'drive'}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground dark:text-muted-foreground">
              {canManagePlatformLibrary
                ? 'Drive files remain in Drive; MedTrack stores a link and reads it through your connected Google account. Course-level textbooks are supported.'
                : 'Your file stays in your Google Drive. MedTrack saves a private reference and reads it through your connected account; no file copy is uploaded to R2.'}
            </p>
            {!driveConnected && !isCheckingDriveConnection && (
              <button
                type="button"
                onClick={handleConnectDrive}
                className="mt-2 rounded-md border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-card"
              >
                Connect personal Google Drive
              </button>
            )}
          </div>}
        </div>

        <div className="flex justify-end pt-4 border-t border-border dark:border-border">
          <div className="flex items-center gap-4">
            {isUploading && (
              <div aria-live="polite" className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Uploading: {uploadProgress}%
              </div>
            )}
            <button
              type="submit"
              disabled={
                isUploading ||
                !title.trim() ||
                !selectedCourseId ||
                (source === 'upload'
                ? !file
                : !driveUrl.trim())
              }
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-500/30"
            >
              {isUploading ? (source === 'drive' ? 'Attaching…' : 'Uploading…') : (source === 'drive' ? 'Attach from Drive' : 'Upload Material')}
            </button>
          </div>
        </div>
          </>
        )}
      </form>
    </div>
  );
}
