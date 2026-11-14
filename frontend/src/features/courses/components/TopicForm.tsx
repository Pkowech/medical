import React, { useState, useEffect, useCallback } from 'react';
import { Topic } from '../services/topicService';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { BookOpen, Library, Paperclip } from 'lucide-react';
import FileUpload from '@/shared/components/forms/FileUpload';
import { BulkQuestionImport } from '@/features/assessment/components/BulkQuestionImport';
import { MaterialLibraryPicker } from '@/features/materials/components/MaterialLibraryPicker';
import { materialService } from '@/features/courses/services/materialService';
import type { Material } from '@/shared/types/materialInterface';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';

interface TopicFormProps {
  topic: Topic | null;
  courseId?: string;
  unitId: string;
  onSave: (topic: Partial<Topic>) => Promise<void>;
  onCancel: () => void;
}

export const TopicForm: React.FC<TopicFormProps> = ({ topic, courseId, unitId, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Topic>>({
    title: '',
    description: '',
    orderIndex: 0,
    isMandatory: false,
    status: 'active',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareWithCourse, setShareWithCourse] = useState(false);

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
      setFormData(topic);
    } else {
      setFormData({
        title: '',
        description: '',
        orderIndex: 0,
        isMandatory: false,
        status: 'active',
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
      [id]: id === 'orderIndex' ? parseFloat(value) : value,
    }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isMandatory: checked,
    }));
  };

  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && unitId) {
      try {
        setLoading(true);
        setErrorMessage(null);
        await onSave(formData);
      } catch (error) {
        console.error('Error saving topic:', error);
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : 'Failed to save topic. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    } else {
      setErrorMessage('Enter a topic title before saving.');
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{topic ? 'Edit Topic' : 'Add New Topic'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title *
            </label>
            <Input 
              id="title" 
              value={formData.title || ''} 
              onChange={handleChange} 
              placeholder="e.g., Skeletal System"
              required 
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={handleChange}
              placeholder="Brief description of the topic"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="orderIndex" className="block text-sm font-medium mb-1">
                Order
              </label>
              <Input
                id="orderIndex"
                type="number"
                value={formData.orderIndex || 0}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <Select
                onValueChange={value => handleSelectChange('status', value)}
                value={formData.status || 'active'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isMandatory"
              checked={formData.isMandatory || false}
              onCheckedChange={handleCheckboxChange}
            />
            <label htmlFor="isMandatory" className="text-sm font-medium cursor-pointer">
              Mark as Mandatory
            </label>
          </div>
          {topic?.id ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Topic assessment
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import a quiz and associate its questions with this topic. Keep it as a draft until it is ready for learners.
                </p>
              </div>
              <BulkQuestionImport
                courseId={courseId || topic.courseId}
                unitId={unitId}
                topicId={topic.id}
                onImported={() => setRefreshKey(current => current + 1)}
              />
            </div>
          ) : (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Save this topic first to add its assessment and learning materials.
            </p>
          )}
          {topic?.id && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Paperclip className="h-4 w-4 text-primary" />
                    Topic materials
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Upload a new resource or attach an existing library item to this topic.
                  </p>
                </div>
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
          )}
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Topic'}
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
