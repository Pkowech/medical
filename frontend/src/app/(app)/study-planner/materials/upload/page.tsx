'use client';

import React, { useState, useEffect } from 'react';
import materialService from '@/features/courses/services/materialService';
import { courseService } from '@/features/courses/services/courseService';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Course, CourseUnit, Lesson, Topic } from '@/shared/types/courseInterface';
import { FileUp, FolderOpen, HardDrive, Link2 } from 'lucide-react';
import DriveFolderImport from '@/features/materials/components/DriveFolderImport';

type ExtendedUnit = CourseUnit & { lessons?: Lesson[] };
type ExtendedCourse = Course & { chapters?: ExtendedUnit[] };
type TopicItem = { id: string | number; title: string };

export default function UploadMaterialPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'upload' | 'drive' | 'folder'>('upload');
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

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await courseService.getPublishedCourses({ page: 1, limit: 50 });
        const courseItems = res.items || [];
        setCourses(courseItems as Course[]);
      } catch (err) {
        console.warn('Failed to load courses for upload form', err);
        setCourseLoadError('Courses could not be loaded. You can still save this material in My Drive.');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    loadCourses();
  }, []);

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
    if (source === 'folder') return;
    if (selectedCourseId && !unitId) {
      toast.error('Choose both a course and a unit, or leave both blank for My Drive');
      return;
    }
    if (source === 'drive' && (!selectedCourseId || !unitId)) {
      toast.error('Choose a course and unit for a Shared Drive material');
      return;
    }
    if (shareWithCourse && (!selectedCourseId || !unitId)) {
      toast.error('Choose a course and unit before sharing with a class');
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
          unitId,
          topicId: topicId || undefined,
          shareWithCourse,
        });
        toast.success('Drive material attached to the unit');
        router.push('/study-planner/materials');
      } catch (err) {
        console.error('Drive material registration failed', err);
        toast.error(err instanceof Error ? err.message : 'Could not attach Drive material');
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

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(
        'Unsupported file type. Allowed types: pdf, doc, docx, ppt, pptx, jpg, png, mp4.'
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
    if (selectedFile.type === 'application/pdf' || filename.endsWith('.pdf')) {
      setType('pdf');
    } else if (selectedFile.type.startsWith('video/') || /\.(mp4|mpeg|mpg|mov|avi|webm)$/.test(filename)) {
      setType('video');
    } else if (
      selectedFile.type === 'application/vnd.ms-powerpoint' ||
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
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
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Upload Material</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm" aria-label="Upload material form">
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">Material source</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Material source">
            <button
              type="button"
              aria-pressed={source === 'upload'}
              onClick={() => setSource('upload')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${source === 'upload' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}
            >
              <FileUp className="h-4 w-4" /> Upload to library
            </button>
            <button
              type="button"
              aria-pressed={source === 'drive'}
              onClick={() => setSource('drive')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${source === 'drive' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}
            >
              <HardDrive className="h-4 w-4" /> Google Drive
            </button>
            <button
              type="button"
              aria-pressed={source === 'folder'}
              onClick={() => setSource('folder')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${source === 'folder' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'}`}
            >
              <FolderOpen className="h-4 w-4" /> Import folder
            </button>
          </div>
        </div>

        {source === 'folder' ? (
          <DriveFolderImport courses={courses} isLoadingCourses={isLoadingCourses} />
        ) : (
          <>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
            aria-required="true"
            placeholder="e.g. Introduction to Pharmacology"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            rows={4}
            placeholder="Brief description of the material..."
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30 space-y-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Placement</h3>
          
          <div>
            <label htmlFor="course-select" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Course <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="course-select"
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              aria-busy={isLoadingCourses}
              className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">My Drive (not assigned to a course)</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name}
                </option>
              ))}
            </select>
            {isLoadingCourses && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400" role="status">Loading available courses…</p>
            )}
            {courseLoadError && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300" role="status">{courseLoadError}</p>
            )}
          </div>

          <div>
            <label htmlFor="unit-select" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Unit <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="unit-select"
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              disabled={!selectedCourseId || isLoadingUnits || units.length === 0}
              required={Boolean(selectedCourseId)}
              aria-busy={isLoadingUnits}
              className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-slate-900"
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

          <div>
            <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Topic / Lesson (optional)
            </label>
            <select
              id="topic-select"
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              disabled={!unitId || topics.length === 0}
              className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-slate-900"
            >
              <option value="">{topics.length === 0 && unitId ? 'No topics found' : '-- Select a Topic --'}</option>
              {topics.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
              Assign both a course and unit to organize this material in a class. Leave both blank to keep it in My Drive. Topic placement is optional.
            </p>
          </div>
          <label className={`flex items-start gap-3 rounded-lg border p-3 ${selectedCourseId && unitId ? 'cursor-pointer border-blue-200 bg-white dark:border-blue-900 dark:bg-slate-900' : 'cursor-not-allowed border-gray-200 opacity-60 dark:border-slate-700'}`}>
            <input
              type="checkbox"
              checked={shareWithCourse}
              disabled={!selectedCourseId || !unitId}
              onChange={(event) => setShareWithCourse(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-800 dark:text-slate-200">Share with enrolled class</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">
                Private by default. Students enrolled in this course can see it only when you turn sharing on.
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {source === 'upload' && <div>
            <label htmlFor="type-select" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Material Type
            </label>
            <select
              id="type-select"
              value={type}
              onChange={e => setType(e.target.value)}
              className="block w-full border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pdf">PDF Document</option>
              <option value="video">Video</option>
              <option value="slide">Presentation</option>
              <option value="notes">Word/Text Notes</option>
            </select>
          </div>}

          {source === 'upload' ? <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">File <span className="text-red-500">*</span></label>
            <input
              type="file"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              aria-label="Select file to upload"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mpeg,.mpg,.mov,.avi,.webm"
              required
            />
            <div className="text-xs text-gray-500 dark:text-slate-500 mt-2">Max size: 50MB. Supported: PDF, DOC, PPT, and common video formats. Title and material type are suggested from the selected file.</div>
          </div> : <div>
            <label htmlFor="drive-url" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Shared Drive file URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="drive-url"
                type="url"
                value={driveUrl}
                onChange={e => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required={source === 'drive'}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The file must be in the institution’s MedTrack Shared Drive. Enrolled students can view it in the course reader; the file is not copied to R2.
            </p>
          </div>}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-800">
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
                (source === 'upload'
                  ? !file || Boolean(selectedCourseId && !unitId)
                  : !driveUrl.trim() || !selectedCourseId || !unitId)
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
