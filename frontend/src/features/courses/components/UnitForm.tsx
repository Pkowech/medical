import React, { useState, useEffect } from 'react';
import { Unit } from '../services/unitService';
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

interface UnitFormProps {
  unit: Unit | null;
  courseId: string;
  onSave: (unit: Partial<Unit>) => Promise<void>;
  onCancel: () => void;
}

export const UnitForm: React.FC<UnitFormProps> = ({ unit, courseId, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Unit>>({
    title: '',
    description: '',
    orderIndex: 0,
    estimatedHours: 0,
    status: 'active',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unit) {
      setFormData(unit);
    } else {
      setFormData({
        title: '',
        description: '',
        orderIndex: 0,
        estimatedHours: 0,
        status: 'active',
      });
    }
  }, [unit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id === 'orderIndex' || id === 'estimatedHours' ? parseFloat(value) : value,
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
    if (formData.title && courseId) {
      try {
        setLoading(true);
        await onSave(formData);
      } catch (error) {
        console.error('Error saving unit:', error);
        alert('Failed to save unit. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Please fill in all required fields.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{unit ? 'Edit Unit' : 'Add New Unit'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title *
            </label>
            <Input 
              id="title" 
              value={formData.title || ''} 
              onChange={handleChange} 
              placeholder="e.g., Introduction to Anatomy"
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
              placeholder="Brief description of the unit"
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
              <label htmlFor="estimatedHours" className="block text-sm font-medium mb-1">
                Estimated Hours
              </label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.5"
                value={formData.estimatedHours || 0}
                onChange={handleChange}
              />
            </div>
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
              {loading ? 'Saving...' : 'Save Unit'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
