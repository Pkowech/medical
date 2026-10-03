'use client';

import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, FolderOpen, LoaderCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import materialService, {
  type DriveFolderPreview,
  type DriveFolderImportResult,
} from '@/features/courses/services/materialService';
import { courseService } from '@/features/courses/services/courseService';
import type { Course, CourseUnit, Lesson, Topic } from '@/shared/types/courseInterface';

type DriveUnit = CourseUnit & { slug?: string; lessons?: Lesson[] };
type DriveCourse = Course & { chapters?: DriveUnit[] };
type DriveTopic = Topic & { slug?: string };
type Placement = { courseId: string; unitId: string; topicId: string };

const normalizeFolderName = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const unitList = (course?: DriveCourse): DriveUnit[] =>
  (course?.units || course?.chapters || []) as DriveUnit[];

const topicList = (unit?: DriveUnit) =>
  (unit?.topics || unit?.lessons || []) as Array<DriveTopic | Lesson>;

const findMatchingValue = <T,>(
  names: string[],
  values: T[],
  getNames: (value: T) => Array<string | null | undefined>,
) => {
  for (const name of names) {
    const normalized = normalizeFolderName(name);
    if (!normalized) continue;
    const match = values.find(value =>
      getNames(value).some(candidate =>
        candidate && normalizeFolderName(candidate) === normalized,
      ),
    );
    if (match) return match;
  }
  return undefined;
};

const matchTopicFromFileName = (
  filename: string,
  topics: Array<DriveTopic | Lesson>,
) => {
  const fileTitle = normalizeFolderName(
    filename.replace(/\.[^.]+$/, '').replace(/^\s*\d+[\s.)-]*/, ''),
  );
  if (!fileTitle) return undefined;
  const matches = topics.filter(topic => {
    const names = [
      (topic as DriveTopic).slug,
      topic.title,
      'name' in topic ? topic.name : undefined,
    ].filter((name): name is string => Boolean(name));
    return names.some(name => {
      const normalized = normalizeFolderName(name);
      return normalized.length > 5 && (
        normalized === fileTitle ||
        fileTitle.includes(normalized)
      );
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
};

interface DriveFolderImportProps {
  courses: Course[];
  isLoadingCourses: boolean;
}

export default function DriveFolderImport({
  courses,
  isLoadingCourses,
}: DriveFolderImportProps) {
  const router = useRouter();
  const [folderUrl, setFolderUrl] = useState('');
  const [preview, setPreview] = useState<DriveFolderPreview | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  const [fileTopics, setFileTopics] = useState<Record<string, string>>({});
  const [courseStructures, setCourseStructures] = useState<Record<string, DriveCourse>>({});
  const [loadingCourseIds, setLoadingCourseIds] = useState<Set<string>>(new Set());
  const structureRequests = useRef(new Map<string, Promise<DriveCourse | null>>());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkProgress, setLinkProgress] = useState({ completed: 0, total: 0 });
  const [shareWithCourse, setShareWithCourse] = useState(false);
  const [importResult, setImportResult] = useState<DriveFolderImportResult | null>(null);

  const groups = useMemo(() => {
    if (!preview) return [];
    const grouped = new Map<string, DriveFolderPreview['files']>();
    for (const file of preview.files) {
      const files = grouped.get(file.folderPath) ?? [];
      files.push(file);
      grouped.set(file.folderPath, files);
    }
    return Array.from(grouped, ([folderPath, files]) => ({ folderPath, files }));
  }, [preview]);

  const loadCourseStructure = async (courseId: string): Promise<DriveCourse | null> => {
    if (courseStructures[courseId]) return courseStructures[courseId];
    const pending = structureRequests.current.get(courseId);
    if (pending) return pending;

    setLoadingCourseIds(previous => new Set(previous).add(courseId));
    const request = courseService.getCourseById(courseId)
      .then(course => {
        const structure = course as DriveCourse;
        setCourseStructures(previous => ({ ...previous, [courseId]: structure }));
        return structure;
      })
      .catch(error => {
        toast.error(error instanceof Error ? error.message : 'Could not load this course structure.');
        return null;
      })
      .finally(() => {
        structureRequests.current.delete(courseId);
        setLoadingCourseIds(previous => {
          const next = new Set(previous);
          next.delete(courseId);
          return next;
        });
      });
    structureRequests.current.set(courseId, request);
    return request;
  };

  const findCourse = (segments: string[]) => {
    for (let index = 0; index < segments.length; index += 1) {
      const candidate = findMatchingValue(segments.slice(index, index + 1), courses, course => [
        course.code,
        course.title,
        course.name,
      ]);
      if (candidate) return { course: candidate, segmentIndex: index };
    }
    return undefined;
  };

  const handlePreview = async () => {
    if (!folderUrl.trim()) {
      toast.error('Paste a Google Drive folder link first.');
      return;
    }
    setIsPreviewing(true);
    setImportResult(null);
    try {
      const result = await materialService.previewGoogleDriveFolder(folderUrl.trim());
      const nextPlacements: Record<string, Placement> = {};
      const nextFileTopics: Record<string, string> = {};
      const candidateCourses = new Map<string, { course: Course; segmentIndex: number; segments: string[] }>();

      for (const group of new Map(
        result.files.map(file => [file.folderPath, file.folderPath]),
      ).values()) {
        const pathSegments = [
          result.folderName,
          ...group.split('/').filter(Boolean),
        ];
        const match = findCourse(pathSegments);
        if (match) {
          candidateCourses.set(group, {
            course: match.course,
            segmentIndex: match.segmentIndex,
            segments: pathSegments,
          });
        } else {
          nextPlacements[group] = { courseId: '', unitId: '', topicId: '' };
        }
      }

      const structuresByCourse = new Map<string, DriveCourse>();
      await Promise.all(
        Array.from(new Set(Array.from(candidateCourses.values(), value => value.course.id)))
          .map(async courseId => {
            const structure = await loadCourseStructure(courseId);
            if (structure) structuresByCourse.set(courseId, structure);
          }),
      );

      for (const [folderPath, candidate] of candidateCourses) {
        const structure = structuresByCourse.get(candidate.course.id);
        const laterSegments = candidate.segments.slice(candidate.segmentIndex + 1);
        const matchedUnit = findMatchingValue(laterSegments, unitList(structure), unit => [
          unit.slug,
          unit.title,
          unit.name,
        ]);
        let matchedFolderTopic: DriveTopic | Lesson | undefined;
        if (matchedUnit) {
          const unitIndex = laterSegments.findIndex(segment =>
            [matchedUnit.slug, matchedUnit.title, matchedUnit.name]
              .some(name => name && normalizeFolderName(name) === normalizeFolderName(segment)),
          );
          matchedFolderTopic = findMatchingValue(
            laterSegments.slice(unitIndex + 1),
            topicList(matchedUnit),
            topic => [
              (topic as DriveTopic).slug,
              topic.title,
              'name' in topic ? topic.name : undefined,
            ],
          );
          for (const file of result.files.filter(item => item.folderPath === folderPath)) {
            const matchedTopic = matchedFolderTopic
              ?? matchTopicFromFileName(file.name, topicList(matchedUnit));
            if (matchedTopic) nextFileTopics[file.id] = String(matchedTopic.id);
          }
        }
        nextPlacements[folderPath] = {
          courseId: candidate.course.id,
          unitId: matchedUnit ? String(matchedUnit.id) : '',
          topicId: '',
        };
      }

      setPreview(result);
      setPlacements(nextPlacements);
      setFileTopics(nextFileTopics);
      setSelectedFileIds(new Set(result.files.filter(file => file.supported).map(file => file.id)));
      if (result.files.length === 0) {
        toast.info('This folder does not contain any files.');
      } else if (!result.files.some(file => file.supported)) {
        toast.info('No supported PDFs or Google Docs, Sheets, or Slides were found.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview this Drive folder.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const updatePlacement = (folderPath: string, changes: Partial<Placement>) => {
    setPlacements(previous => {
      const current = previous[folderPath] ?? { courseId: '', unitId: '', topicId: '' };
      return { ...previous, [folderPath]: { ...current, ...changes } };
    });
  };

  const handleCourseChange = async (folderPath: string, courseId: string) => {
    updatePlacement(folderPath, { courseId, unitId: '', topicId: '' });
    setFileTopics(previous => {
      const next = { ...previous };
      for (const file of groups.find(group => group.folderPath === folderPath)?.files ?? []) {
        delete next[file.id];
      }
      return next;
    });
    if (courseId) await loadCourseStructure(courseId);
  };

  const handleUnitChange = (folderPath: string, unitId: string) => {
    updatePlacement(folderPath, { unitId, topicId: '' });
    const group = groups.find(item => item.folderPath === folderPath);
    const courseId = placements[folderPath]?.courseId;
    const unit = unitList(courseStructures[courseId]).find(item => String(item.id) === unitId);
    if (!group || !unit) return;

    setFileTopics(previous => {
      const next = { ...previous };
      for (const file of group.files) {
        const suggested = matchTopicFromFileName(file.name, topicList(unit));
        if (suggested) next[file.id] = String(suggested.id);
        else delete next[file.id];
      }
      return next;
    });
  };

  const toggleFile = (fileId: string) => {
    setSelectedFileIds(previous => {
      const next = new Set(previous);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const selectedFiles = preview?.files.filter(
    file => selectedFileIds.has(file.id) && file.supported,
  ) ?? [];
  const invalidSelectedFiles = groups.filter(group =>
    group.files.some(file => selectedFileIds.has(file.id) && file.supported) &&
    (!placements[group.folderPath]?.courseId || !placements[group.folderPath]?.unitId),
  );
  const importDisabled =
    isLinking ||
    selectedFiles.length === 0 ||
    invalidSelectedFiles.length > 0;

  const handleImport = async () => {
    if (importDisabled) return;
    setIsLinking(true);
    setImportResult(null);
    setLinkProgress({ completed: 0, total: selectedFiles.length });
    try {
      const items = selectedFiles.map(file => ({
          fileId: file.id,
          title: file.name.replace(/\.[^.]+$/, ''),
          courseId: placements[file.folderPath].courseId,
          unitId: placements[file.folderPath].unitId,
          topicId: fileTopics[file.id] || undefined,
          shareWithCourse,
      }));
      const results: DriveFolderImportResult['results'] = [];
      for (let offset = 0; offset < items.length; offset += 200) {
        const batch = await materialService.linkGoogleDriveFolder({
          items: items.slice(offset, offset + 200),
        });
        results.push(...batch.results);
        setLinkProgress({
          completed: Math.min(offset + batch.results.length, items.length),
          total: items.length,
        });
      }
      const result: DriveFolderImportResult = {
        linked: results.filter(item => item.status === 'linked').length,
        alreadyLinked: results.filter(item => item.status === 'already-linked').length,
        failed: results.filter(item => item.status === 'failed').length,
        results,
      };
      setImportResult(result);
      if (result.failed === 0) {
        toast.success(`${result.linked} linked from Drive; ${result.alreadyLinked} already linked.`);
        router.push('/study-planner/materials');
      } else {
        toast.error(`${result.failed} file${result.failed === 1 ? '' : 's'} could not be linked. Review the results below.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Drive folder link failed.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <section className="space-y-6" aria-label="Link files from a Drive folder">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Link a Year or subject folder</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Preview its files, then map each Drive folder to an existing course and unit. Topics are suggested from folder and file names; course codes are matched too.
            </p>
          </div>
        </div>
        <label htmlFor="drive-folder-url" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Shared Drive folder link
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="drive-folder-url"
            type="url"
            value={folderUrl}
            onChange={event => setFolderUrl(event.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing || isLoadingCourses || courses.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            {isPreviewing ? 'Scanning folder…' : 'Preview files'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          The folder must be in the configured MedTrack Shared Drive and contain no more than 500 files. Only PDFs and Google Docs, Sheets, and Slides can be linked.
        </p>
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{preview.folderName}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {preview.files.filter(file => file.supported).length} supported of {preview.files.length} files · {selectedFiles.length} selected
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={shareWithCourse}
                onChange={event => setShareWithCourse(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Share these Drive links with enrolled students
            </label>
          </div>

          {groups.map(group => {
            const placement = placements[group.folderPath] ?? { courseId: '', unitId: '', topicId: '' };
            const structure = courseStructures[placement.courseId];
            const availableUnits = unitList(structure);
            const selectedUnit = availableUnits.find(unit => String(unit.id) === placement.unitId);
            const availableTopics = topicList(selectedUnit);
            const groupHasSelectedFiles = group.files.some(file => selectedFileIds.has(file.id) && file.supported);

            return (
              <section
                key={group.folderPath || '__root'}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="truncate font-medium text-slate-800 dark:text-slate-100">
                      <FolderOpen className="mr-2 inline h-4 w-4 text-amber-500" />
                      {group.folderPath || '(files directly in selected folder)'}
                    </h4>
                    <span className="shrink-0 text-xs text-slate-500">{group.files.length} files</span>
                  </div>
                  {groupHasSelectedFiles && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Course
                        <select
                          value={placement.courseId}
                          onChange={event => void handleCourseChange(group.folderPath, event.target.value)}
                          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="">Choose course…</option>
                          {courses.map(course => (
                            <option key={course.id} value={course.id}>
                              {course.code ? `${course.code} — ` : ''}{course.title || course.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Unit
                        <select
                          value={placement.unitId}
                          disabled={!placement.courseId || loadingCourseIds.has(placement.courseId) || availableUnits.length === 0}
                          onChange={event => handleUnitChange(group.folderPath, event.target.value)}
                          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        >
                          <option value="">
                            {loadingCourseIds.has(placement.courseId) ? 'Loading units…' : 'Choose unit…'}
                          </option>
                          {availableUnits.map(unit => (
                            <option key={unit.id} value={String(unit.id)}>
                              {unit.title || unit.name || String(unit.id)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.files.map(file => (
                    <li key={file.id} className="flex items-start gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedFileIds.has(file.id)}
                        disabled={!file.supported || isLinking}
                        onChange={() => toggleFile(file.id)}
                        aria-label={`Select ${file.name}`}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                      />
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                        <p className="text-xs text-slate-500">
                          {file.size ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · ` : ''}
                          {file.supported ? file.mimeType.replace('application/vnd.google-apps.', 'Google ') : 'Unsupported file type'}
                        </p>
                        {file.supported && placement.unitId && (
                          <label className="mt-2 block max-w-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                            Topic (optional)
                            <select
                              value={fileTopics[file.id] ?? ''}
                              disabled={isLinking || availableTopics.length === 0}
                              onChange={event => setFileTopics(previous => ({
                                ...previous,
                                [file.id]: event.target.value,
                              }))}
                              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                              <option value="">No topic / unit-level material</option>
                              {availableTopics.map(topic => (
                                <option key={topic.id} value={String(topic.id)}>
                                  {topic.title || ('name' in topic ? topic.name : undefined) || String(topic.id)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      {file.supported && placement.courseId && placement.unitId && (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Mapped" />
                      )}
                      {!file.supported && <span className="shrink-0 text-xs text-slate-400">Not supported</span>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {invalidSelectedFiles.length > 0 && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Choose an existing course and unit for each selected folder before linking. Course codes such as PPA 511 match regardless of spaces or letter case; unknown unit/topic codes need to be mapped here.
            </p>
          )}
          {importResult && importResult.results.some(result => result.status === 'failed') && (
            <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
              <p className="font-medium text-red-800 dark:text-red-200">
                Linked {importResult.linked}; already linked {importResult.alreadyLinked}; failed {importResult.failed}.
              </p>
              <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-300">
                {importResult.results.filter(result => result.status === 'failed').map(result => (
                  <li key={result.fileId}>{result.title}: {result.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Files stay in Google Drive; MedTrack stores references and reads them through the configured Drive connection. Nothing is copied to MedTrack storage. Links remain private in MedTrack by default; sharing is optional.
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLinking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isLinking
                ? `Linking ${linkProgress.completed} of ${linkProgress.total}…`
                : `Link ${selectedFiles.length} Drive file${selectedFiles.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
