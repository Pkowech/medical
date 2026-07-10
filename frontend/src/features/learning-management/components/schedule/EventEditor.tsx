// Enhanced event editor with calendar features
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import type { Event } from '@/features/learning-management/study/services/scheduleService';
import {
  PRIORITY_LEVELS,
  EVENT_STATUS,
  RECURRENCE_PATTERNS,
  DEFAULT_REMINDERS,
  formatReminderTime,
} from '../../utils/calendarFeatures';

interface EventEditorProps {
  event: Partial<Event>;
  onUpdate: (event: Partial<Event>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  showAdvanced?: boolean;
}

export function EventEditor({
  event,
  onUpdate,
  onCancel,
  isSubmitting = false,
  showAdvanced = true,
}: EventEditorProps) {
  const [formData, setFormData] = useState(event);
  const [showRecurrence, setShowRecurrence] = useState(false);

  // Sync formData when event prop changes (bug fix #1)
  useEffect(() => {
    setFormData(event);
  }, [event]);

  const handleChange = (key: keyof Event, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onUpdate(formData);
  };

  return (
    <div className="space-y-4 w-full max-w-2xl">
      {/* Basic Information */}
      <div className="space-y-3">
        <div>
          <Label>Title *</Label>
          <Input
            value={formData.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Event title"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Add notes or details..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={formatDateTimeForInput(formData.date)}
              onChange={(e) => handleChange('date', new Date(e.target.value))}
            />
          </div>
          <div>
            <Label>End Date & Time</Label>
            <Input
              type="datetime-local"
              value={formatDateTimeForInput(formData.endDate)}
              onChange={(e) => handleChange('endDate', new Date(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            checked={formData.allDay || false}
            onCheckedChange={(checked) => handleChange('allDay', checked === true)}
            id="allDay"
          />
          <Label htmlFor="allDay" className="cursor-pointer">
            All-day event
          </Label>
        </div>
      </div>

      {/* Event Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={formData.type || 'study'} onValueChange={(v) => handleChange('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">Lecture</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="goal">Goal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category</Label>
              <Select value={formData.category || 'academic'} onValueChange={(v) => handleChange('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Location</Label>
              <Input
                value={formData.location || ''}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Where?"
              />
            </div>

            <div>
              <Label>Instructor/Lead</Label>
              <Input
                value={formData.instructor || ''}
                onChange={(e) => handleChange('instructor', e.target.value)}
                placeholder="Name or email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority & Status */}
      {showAdvanced && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Priority & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={String(formData.priority || 1)} onValueChange={(v) => handleChange('priority', parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LEVELS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.icon} {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={formData.status || 'pending'} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_STATUS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.icon} {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: '#3b82f6', label: 'Blue' },
                  { value: '#ef4444', label: 'Red' },
                  { value: '#10b981', label: 'Green' },
                  { value: '#f97316', label: 'Orange' },
                  { value: '#a855f7', label: 'Purple' },
                  { value: '#eab308', label: 'Yellow' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === value ? 'border-gray-900 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: value }}  
                    onClick={() => handleChange('color', value)}
                    title={`Select ${label} color`}
                    aria-label={`Select ${label} color`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.completed || false}
                onCheckedChange={(checked) => handleChange('completed', checked === true)}
                id="completed"
              />
              <Label htmlFor="completed" className="cursor-pointer">
                Mark as completed
              </Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring Events */}
      {showAdvanced && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recurrence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.isRecurring || false}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  handleChange('isRecurring', isChecked);
                  setShowRecurrence(isChecked);
                }}
                id="recurring"
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Repeat this event
              </Label>
            </div>

            {showRecurrence && (
              <Select
                value={formData.recurrencePattern?.frequency || 'weekly'}
                onValueChange={(v) =>
                  handleChange('recurrencePattern', {
                    ...formData.recurrencePattern,
                    frequency: v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(RECURRENCE_PATTERNS).map((pattern) => (
                    <SelectItem key={pattern.value} value={pattern.value}>
                      {pattern.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reminders */}
      {showAdvanced && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(formData.reminders || [15, 1440]).map((reminder, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    const updated = (formData.reminders || []).filter((_, i) => i !== idx);
                    handleChange('reminders', updated);
                  }}
                >
                  {formatReminderTime(reminder)} ✕
                </Badge>
              ))}
            </div>

            <Select onValueChange={(v) => {
              const time = parseInt(v);
              const existing = formData.reminders || [];
              // Bug fix #11: Prevent duplicate reminders
              if (!existing.includes(time)) {
                handleChange('reminders', [...existing, time]);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Add reminder..." />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_REMINDERS.map((rem) => (
                  <SelectItem key={rem.value} value={String(rem.value)}>
                    {rem.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !formData.title}
          className="flex-1"
        >
          {isSubmitting ? 'Saving...' : 'Save Event'}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Format date for datetime-local input (bug fix #5)
 */
function formatDateTimeForInput(date?: Date | string): string {
  if (!date) return new Date().toISOString().split('T')[0] + 'T09:00';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0] + 'T09:00';
  return d.toISOString().split('T')[0] + 'T' + d.toTimeString().split(' ')[0].substring(0, 5);
}
