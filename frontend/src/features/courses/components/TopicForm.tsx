import React, { useState, useEffect } from 'react';
import { Topic } from '../services/topicService';
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
import { Checkbox } from '@/shared/components/ui/checkbox';

interface TopicFormProps {
  topic: Topic | null;
  unitId: string;
  onSave: (topic: Partial<Topic>) => Promise<void>;
  onCancel: () => void;
}

export const TopicForm: React.FC<TopicFormProps> = ({ topic, unitId, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Topic>>({
    title: '',
    description: '',
    orderIndex: 0,
    isMandatory: false,
    status: 'active',
  });

  const [loading, setLoading] = useState(false);

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
        await onSave(formData);
      } catch (error) {
        console.error('Error saving topic:', error);
        alert('Failed to save topic. Please try again.');
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
        <CardTitle>{topic ? 'Edit Topic' : 'Add New Topic'}</CardTitle>
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
      </CardContent>
    </Card>
  );
};
