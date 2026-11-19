import React, { useState, useEffect, useCallback } from 'react';
import { Topic } from '../services/topicService';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { BookOpen, ChevronRight, Library, Paperclip } from 'lucide-react';
import FileUpload from '@/shared/components/forms/FileUpload';
import { BulkQuestionImport } from '@/features/assessment/components/BulkQuestionImport';
import { MaterialLibraryPicker } from '@/features/materials/components/MaterialLibraryPicker';
import { materialService } from '@/features/courses/services/materialService';
import type { Material } from '@/shared/types/materialInterface';
import { Checkbox } from '@/shared/components/ui/checkbox';

const INITIAL_MATERIAL_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'mp4', 'mpg', 'mpeg', 'mov', 'avi', 'webm',
]);

const topicStatusLabels: Record<NonNullable<Topic['status']>, string> = {
  draft: 'Draft',
  under_review: 'Under review',
  published: 'Published',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};

const getSaveErrorMessage = (cause: unknown): string => {
  if (cause && typeof cause === 'object') {
    const response = 'response' in cause ? cause.response : undefined;
    const responseData =
      response && typeof response === 'object' && 'data' in response
        ? response.data
        : undefined;
    const apiMessage =
      responseData && typeof responseData === 'object' && 'message' in responseData
        ? responseData.message
        : undefined;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (
      Array.isArray(apiMessage) &&
      apiMessage.every(message => typeof message === 'string')
    ) {
      return apiMessage.join(' ');
    }
  }
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  return 'The topic could not be saved. Check your connection and try again.';
};

interface TopicFormProps {
  topic: Topic | null;
  courseId?: string;
  courseTitle?: string;
  unitId: string;
  unitTitle?: string;
  onSave: (topic: Partial<Topic>, hasPendingMaterial: boolean) => Promise<Topic | void>;
  onCancel: () => void;
  cancelLabel?: string;
}

export const TopicForm: React.FC<TopicFormProps> = ({
  topic,
  courseId,
  courseTitle,
  unitId,
  unitTitle,
  onSave,
  onCancel,
  cancelLabel = 'Cancel',
}) => {
  const [formData, setFormData] = useState<Partial<Topic>>({
    name: '',
    description: '',
    orderIndex: undefined,
    quizQuestionCount: 10,
    isMandatory: false,
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareWithCourse, setShareWithCourse] = useState(false);
  const [initialMaterialFile, setInitialMaterialFile] = useState<File | null>(null);
  const [initialMaterialTitle, setInitialMaterialTitle] = useState('');

  const loadMaterials = useCallback(async () => {
    if (!topic?.id) return;
    setMaterialsLoading(true);
    setMaterialsError(null);
    try {
      setMaterials(await materialService.getMaterials({ topicId: topic.id }));
    } catch (error) {
      console.error('Failed to load topic materials:', error);
      setMaterialsError('Topic materials could not be loaded.');
    } finally {
      setMaterialsLoading(false);
    }
  }, [topic?.id]);

  useEffect(() => {
    if (topic) {
      const { title, ...topicData } = topic;
      setFormData({
        ...topicData,
        name: topicData.name || title,
        orderIndex: topic.orderIndex ?? topic.order,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        orderIndex: undefined,
        quizQuestionCount: 10,
        isMandatory: false,
      });
    }
  }, [topic]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials, refreshKey]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id === 'orderIndex' || id === 'quizQuestionCount'
        ? (value === '' ? undefined : Number(value))
        : value,
    }));
    setErrorMessage(null);
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isMandatory: checked,
    }));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name?.trim() || formData.title?.trim();
    const order = formData.orderIndex ?? formData.order;
    const questionCount = formData.quizQuestionCount ?? 10;
    if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
      setErrorMessage('Topic order must be a whole number greater than zero.');
      return;
    }
    if (
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > 100
    ) {
      setErrorMessage('Questions per quiz must be a whole number from 1 to 100.');
      return;
    }

    if (name && unitId) {
      let topicSaved = false;
      try {
        setLoading(true);
        setErrorMessage(null);
        const { title: _title, status: _status, ...topicData } = formData;
        const savedTopic = await onSave(
          { ...topicData, orderIndex: order, quizQuestionCount: questionCount, name },
          Boolean(initialMaterialFile),
        );
        topicSaved = true;

        if (initialMaterialFile) {
          const targetTopic = savedTopic || topic;
          if (!targetTopic?.id) {
            throw new Error('The topic was saved, but its ID was not returned for the material upload.');
          }
          const materialCourseId = courseId || targetTopic.courseId;
          if (!materialCourseId) {
            throw new Error('The topic was saved, but a course is required to upload its material.');
          }

          const materialFormData = new FormData();
          materialFormData.append('file', initialMaterialFile);
          materialFormData.append('title', initialMaterialTitle.trim() || initialMaterialFile.name);
          materialFormData.append('courseId', materialCourseId);
          materialFormData.append('unitId', unitId);
          materialFormData.append('topicId', targetTopic.id);
          materialFormData.append('shareWithCourse', String(shareWithCourse));
          materialFormData.append('storageProvider', 'google-drive');
          await materialService.uploadMaterial(materialFormData);
          setInitialMaterialFile(null);
          setInitialMaterialTitle('');
          setRefreshKey(current => current + 1);
        }
      } catch (error) {
        console.error('Error saving topic:', error);
        const message = getSaveErrorMessage(error);
        setErrorMessage(topicSaved
          ? `Topic saved, but its material could not be uploaded. Save again to retry. ${message}`
          : `Failed to save topic. ${message}`);
      } finally {
        setLoading(false);
      }
    } else {
      setErrorMessage('Enter a topic name before saving.');
    }
  };

  const handleInitialMaterialChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (selectedFile.size > 50 * 1024 * 1024) {
      setInitialMaterialFile(null);
      setInitialMaterialTitle('');
      setErrorMessage('Material file must be 50MB or smaller.');
      event.target.value = '';
      return;
    }
    if (!extension || !INITIAL_MATERIAL_EXTENSIONS.has(extension)) {
      setInitialMaterialFile(null);
      setInitialMaterialTitle('');
      setErrorMessage('Choose a PDF, DOC, DOCX, PPT, PPTX, or supported video file.');
      event.target.value = '';
      return;
    }

    setErrorMessage(null);
    setInitialMaterialFile(selectedFile);
    setInitialMaterialTitle(selectedFile.name.replace(/\.[^.]+$/, ''));
  };

  const handleAttachMaterial = async (
    material: Material,
    context: { topicId?: string; unitId?: string; courseId?: string; title: string },
  ) => {
    if (!context.topicId || !context.unitId || !context.courseId) {
      throw new Error('Save the topic before attaching materials.');
    }
    await materialService.attachMaterial({
      sourceMaterialId: material.id,
      title: context.title,
      topicId: context.topicId,
      unitId: context.unitId,
      courseId: context.courseId,
      shareWithCourse,
    });
    setRefreshKey(current => current + 1);
  };
  const topicStatus = topic?.status;
  const topicStatusLabel = topicStatus
    ? topicStatusLabels[topicStatus] ?? 'Unknown status'
    : topic
      ? 'Status unavailable'
      : 'Published on save';
  const topicSavedButMaterialFailed = errorMessage?.startsWith('Topic saved,') ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{topic ? 'Edit Topic' : 'Add New Topic'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          aria-label="Topic placement"
          className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3"
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {topic ? 'Topic location' : 'Adding topic to'}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div>
              <span className="mr-2 text-muted-foreground">Course</span>
              <span className="font-semibold">{courseTitle || 'Current course'}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <span className="mr-2 text-muted-foreground">Unit</span>
              <span className="font-semibold">{unitTitle || 'Current unit'}</span>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p className="font-semibold">
                {topicSavedButMaterialFailed
                  ? 'Topic saved; material upload needs attention'
                  : 'Could not save this topic'}
              </p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          )}
          <fieldset className="space-y-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Topic details</legend>
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">
                Topic name *
              </label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={handleChange}
                placeholder="e.g., Skeletal System"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="description" className="mb-1 block text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={handleChange}
                placeholder="Briefly describe what learners will study"
                rows={3}
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="orderIndex" className="mb-1 block text-sm font-medium">
                  Position in unit
                </label>
                <Input
                  id="orderIndex"
                  type="number"
                  min={1}
                  step={1}
                  value={formData.orderIndex ?? ''}
                  onChange={handleChange}
                  placeholder="Next available"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {topic ? 'Leave blank to keep its current position.' : 'Leave blank to add this topic at the end.'}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Publication status</span>
                <div className="flex min-h-10 items-center gap-2">
                  <Badge variant={topicStatus === 'published' || !topic ? 'default' : 'outline'}>
                    {topicStatusLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Managed by the publishing workflow.
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This form does not change publication status.
                </p>
              </div>
            </div>
          </fieldset>
          <fieldset className="space-y-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Assessment settings</legend>
            <div>
              <label htmlFor="quizQuestionCount" className="mb-1 block text-sm font-medium">
                Maximum questions per topic quiz
              </label>
              <Input
                id="quizQuestionCount"
                type="number"
                min={1}
                max={100}
                step={1}
                value={formData.quizQuestionCount ?? 10}
                onChange={handleChange}
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each attempt draws up to this many random questions. If fewer eligible questions are linked, learners receive fewer.
              </p>
            </div>
            <div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="isMandatory"
                  checked={formData.isMandatory || false}
                  onCheckedChange={handleCheckboxChange}
                  disabled={loading}
                />
                <label htmlFor="isMandatory" className="text-sm font-medium leading-5">
                  Mark as mandatory
                </label>
              </div>
              <p className="ml-6 mt-1 text-xs text-muted-foreground">
                Shows a mandatory badge to learners and excludes this topic from focus recommendations; it does not block progression.
              </p>
            </div>
          </fieldset>
          {(!topic?.id || initialMaterialFile) && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Initial topic material (optional)
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a file up to 50MB. It will be saved in the Google Drive account linked to your profile and linked to this topic.
                </p>
                <a
                  href="/study-planner/materials/upload"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-primary underline-offset-4 hover:underline"
                >
                  Connect or update Google Drive permissions
                </a>
              </div>
              <label htmlFor="initial-topic-material" className="block text-sm font-medium">
                Choose material file
              </label>
              <Input
                id="initial-topic-material"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mpg,.mpeg,.mov,.avi,.webm"
                onChange={handleInitialMaterialChange}
                disabled={loading}
              />
              {initialMaterialFile && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Selected: {initialMaterialFile.name} ({(initialMaterialFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                  <div>
                    <label htmlFor="initial-material-title" className="mb-1 block text-sm font-medium">
                      Material title
                    </label>
                    <Input
                      id="initial-material-title"
                      value={initialMaterialTitle}
                      onChange={event => setInitialMaterialTitle(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </>
              )}
              {!topic?.id && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="shareInitialTopicMaterial"
                    checked={shareWithCourse}
                    onCheckedChange={checked => setShareWithCourse(checked === true)}
                  />
                  <label htmlFor="shareInitialTopicMaterial" className="text-sm leading-5">
                    Make the uploaded material available to enrolled learners
                    <span className="block text-xs text-muted-foreground">
                      Unchecked materials remain private to their owner and course staff.
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}
          {topic?.id ? (
            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer font-semibold">
                <span className="inline-flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Topic assessment and question bank
                </span>
                <span className="mt-1 block pl-6 text-sm font-normal text-muted-foreground">
                  Import questions and associate them with this topic.
                </span>
              </summary>
              <div className="mt-4">
                <p className="mb-4 text-sm text-muted-foreground">
                  Keep imported questions as a draft until they are ready for learners.
                </p>
                <BulkQuestionImport
                  courseId={courseId || topic.courseId}
                  unitId={unitId}
                  topicId={topic.id}
                  onImported={() => setRefreshKey(current => current + 1)}
                />
              </div>
            </details>
          ) : (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Save this topic first to add its assessment and learning materials.
            </p>
          )}
          {topic?.id && (
            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer font-semibold">
                <span className="inline-flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Topic materials{!materialsLoading ? ` (${materials.length})` : ''}
                </span>
                <span className="mt-1 block pl-6 text-sm font-normal text-muted-foreground">
                  Upload a resource or attach an existing library item.
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-start justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowLibraryPicker(true)}
                    disabled={!courseId && !topic.courseId}
                  >
                    <Library className="mr-2 h-4 w-4" />
                    Attach from library
                  </Button>
                </div>
                {materialsError && <p role="alert" className="text-sm text-destructive">{materialsError}</p>}
                {materialsLoading ? (
                  <p role="status" className="text-sm text-muted-foreground">Loading topic materials…</p>
                ) : materials.length > 0 ? (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {materials.map(material => (
                      <li key={material.id} className="px-3 py-2">
                        <p className="text-sm font-medium">{material.title}</p>
                        <p className="text-xs text-muted-foreground">{material.type || material.contentType}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No materials are linked to this topic yet.</p>
                )}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="shareTopicMaterials"
                    checked={shareWithCourse}
                    onCheckedChange={checked => setShareWithCourse(checked === true)}
                  />
                  <label htmlFor="shareTopicMaterials" className="text-sm leading-5">
                    Make newly added materials available to enrolled learners
                    <span className="block text-xs text-muted-foreground">
                      Unchecked materials remain private to their owner and course staff.
                    </span>
                  </label>
                </div>
                {courseId || topic.courseId ? (
                  <FileUpload
                    courseId={courseId || topic.courseId}
                    unitId={unitId}
                    topicId={topic.id}
                    shareWithCourse={shareWithCourse}
                    onUploadComplete={() => setRefreshKey(current => current + 1)}
                    maxFileSizeMB={50}
                    allowedFileTypes={['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.webm']}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Course placement is required before uploading material to this topic.
                  </p>
                )}
              </div>
            </details>
          )}
          <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end space-x-2 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button 
              type="submit"
              disabled={loading}
            >
              {loading
                ? initialMaterialFile ? 'Saving and uploading...' : 'Saving...'
                : initialMaterialFile ? 'Save Topic and Upload Material' : 'Save Topic'}
            </Button>
          </div>
        </form>
        {showLibraryPicker && topic?.id && (
          <MaterialLibraryPicker
            topicId={topic.id}
            unitId={unitId}
            courseId={courseId || topic.courseId}
            onClose={() => setShowLibraryPicker(false)}
            onAttach={handleAttachMaterial}
          />
        )}
      </CardContent>
    </Card>
  );
};
