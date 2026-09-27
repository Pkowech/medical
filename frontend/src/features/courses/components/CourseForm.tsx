// frontend/src/components/admin/CourseForm.tsx

import React, { useState, useEffect } from 'react';
import { Course } from '@/shared/types/courseInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { courseService } from '../services/courseService';

interface CourseFormProps {
  course: Course | null;
  onSave: (course: Partial<Course>) => Promise<void>;
  onCancel: () => void;
}

export const CourseForm: React.FC<CourseFormProps> = ({ course, onSave, onCancel }) => {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryReloadKey, setCategoryReloadKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    description: '',
    categoryId: '',
    estimatedHours: 0,
    price: 0,
    status: 'draft',
  });

  useEffect(() => {
    let isCurrent = true;
    setCategoriesLoading(true);
    setCategoriesError(null);

    courseService.getCategories()
      .then(cats => {
        if (isCurrent) setCategories(cats);
      })
      .catch(() => {
        if (isCurrent) {
          setCategoriesError('Categories could not be loaded. Try again.');
        }
      })
      .finally(() => {
        if (isCurrent) setCategoriesLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [categoryReloadKey]);

  useEffect(() => {
    if (course) {
      setFormData(course);
    } else {
      setFormData({
        title: '',
        description: '',
        categoryId: '',
        estimatedHours: 0,
        price: 0,
        status: 'draft',
      });
    }
  }, [course]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id === 'estimatedHours' || id === 'price' ? (value === '' ? 0 : Number(value)) : value,
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
    const title = formData.title?.trim();
    const description = formData.description?.trim();
    const categoryExists = categories.some(category => category.id === formData.categoryId);

    if (!title || !description) {
      setFormError('Enter a title and description.');
      return;
    }
    if (!categoryExists) {
      setFormError('Select a category from the available categories.');
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        title,
        description,
        categoryId: formData.categoryId,
        name: formData.name?.trim() || title,
        estimatedHours: Number(formData.estimatedHours) || 0,
        price: Number(formData.price) || 0,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{course ? 'Edit Course' : 'Add New Course'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title
            </label>
            <Input id="title" value={formData.title || ''} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium mb-1">
              Category
            </label>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground" role="status">Loading categories...</p>
            ) : categoriesError ? (
              <div className="flex items-center gap-3" role="alert">
                <p className="text-sm text-destructive">{categoriesError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCategoryReloadKey(key => key + 1)}
                >
                  Retry
                </Button>
              </div>
            ) : categories.length > 0 ? (
              <Select
                onValueChange={value => handleSelectChange('categoryId', value)}
                value={categories.some(category => category.id === formData.categoryId) ? formData.categoryId : ''}
              >
                <SelectTrigger id="categoryId" className="w-full" aria-required="true">
                  <SelectValue placeholder="Select a category">
                    {categories.find(category => category.id === formData.categoryId)?.name || 'Select a category'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-destructive" role="alert">
                No categories are available. Create a course category before adding a course.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="estimatedHours" className="block text-sm font-medium mb-1">
              Estimated Hours
            </label>
            <Input
              id="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              value={formData.estimatedHours || 0}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium mb-1">
              Price
            </label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price || 0}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-1">
              Status
            </label>
            <Select
              onValueChange={value => handleSelectChange('status', value)}
              value={formData.status}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || categoriesLoading || !!categoriesError || categories.length === 0}
            >
              {isSaving ? 'Saving...' : course ? 'Save Changes' : 'Create Course'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
