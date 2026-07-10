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

interface CourseFormProps {
  course: Course | null;
  onSave: (course: Partial<Course>) => Promise<void>;
  onCancel: () => void;
}

export const CourseForm: React.FC<CourseFormProps> = ({ course, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    description: '',
    categoryId: '',
    estimatedHours: 0,
    price: 0,
    status: 'draft',
  });

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
      [id]: value,
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
    if (formData.title && formData.description && formData.categoryId) {
      await onSave(formData);
    } else {
      alert('Please fill in all required fields.');
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
              Category ID
            </label>
            <Input
              id="categoryId"
              value={formData.categoryId || ''}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label htmlFor="estimatedHours" className="block text-sm font-medium mb-1">
              Estimated Hours
            </label>
            <Input
              id="estimatedHours"
              type="number"
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
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save Course</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
