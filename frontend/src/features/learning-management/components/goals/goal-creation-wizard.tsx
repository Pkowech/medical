'use client';

import React, { useState, useEffect } from 'react';
import {
  Target,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  AlertCircle,
  Lightbulb,
  Star,
} from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { GoalCreationWizardProps, SMARTSuggestions, LearningGoal } from '@/shared/types/learningGoalsInterface';

type Milestone = {
  title: string;
  description?: string;
  targetDate?: string;
  targetValue?: number;
  order?: number;
};

export const GoalCreationWizard: React.FC<GoalCreationWizardProps> = ({
  isOpen,
  onClose,
  onGoalCreated,
  initialData,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [goalData, setGoalData] = useState({
    title: '',
    description: '',
    type: 'shortTerm',
    category: 'custom',
    priority: 'medium',
    targetCriteria: {
      type: 'numeric',
      targetValue: 0,
      unit: '',
      measurementMethod: '',
    },
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    learningPathId: '',
    courseId: '',
    smartCriteria: {
      specific: '',
      measurable: '',
      achievable: '',
      relevant: '',
      timeBound: '',
    },
    milestones: [] as Milestone[],
    reminderSettings: {
      enabled: true,
      frequency: 'daily' as const,
      time: '09:00',
    },
    progressTracking: {
      autoTracking: false,
      manualUpdates: true,
      dataSources: [] as string[],
      updateFrequency: 'manual' as const,
    },
    dependsOnGoalId: '',
    status: 'active', // Important: status must be lowercase 'active'
  });

  const [availableGoals, setAvailableGoals] = useState<LearningGoal[]>([]);

  useEffect(() => {
    if (isOpen && initialData) {
      const targetValue = initialData.targetCriteria?.targetValue;
      setGoalData(prev => ({
        ...prev,
        ...initialData,
        targetCriteria: {
          ...prev.targetCriteria,
          ...(initialData.targetCriteria || {}),
          targetValue: typeof targetValue === 'string' ? parseFloat(targetValue) : targetValue || 0,
        },
        smartCriteria: {
          ...prev.smartCriteria,
        }
      }));
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, initialData]);
  const [smartSuggestions, setSmartSuggestions] = useState<SMARTSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const getErrorMessage = (e: unknown): string => {
    if (e == null) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (typeof e === 'object' && e !== null) {
      const obj = e as any;
      // Check for nested error messages from backend response
      if (obj.response?.data?.message) return obj.response.data.message;
      if (obj.data?.message) return obj.data.message;
      if (obj.message) return obj.message;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return 'An unexpected error occurred';
    }
  };

  const steps = [
    { id: 1, title: 'Goal Basics', description: 'Define your goal' },
    { id: 2, title: 'SMART Criteria', description: 'Make it specific and measurable' },
    { id: 3, title: 'Timeline & Milestones', description: 'Set deadlines and checkpoints' },
    { id: 4, title: 'Tracking & Reminders', description: 'Configure progress tracking' },
    { id: 5, title: 'Review & Create', description: 'Confirm your goal' },
  ];

  useEffect(() => {
    if (currentStep === 2 && goalData.title && goalData.category) {
      generateSMARTSuggestions();
    }
  }, [currentStep, goalData.title, goalData.category]);

  const generateSMARTSuggestions = async () => {
    try {
      const response = await apiService.post<SMARTSuggestions>(`/learning-goals/smart-suggestions`, {
        title: goalData.title,
        category: goalData.category,
        targetCriteria: goalData.targetCriteria,
      });

      const suggestions = response.data;
      setSmartSuggestions(suggestions);
      setGoalData(prev => ({
        ...prev,
        smartCriteria: suggestions,
      }));
    } catch (error) {
      console.error('Error generating SMART suggestions:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailableGoals();
    }
  }, [isOpen]);

  const fetchAvailableGoals = async () => {
    try {
      const response = await apiService.get<LearningGoal[] | { data: LearningGoal[] }>(`/learning-goals?status=active`);
      const data = 'data' in response.data ? (Array.isArray(response.data.data) ? response.data.data : []) : (Array.isArray(response.data) ? response.data : []);
      // Filter out current goal if editing
      setAvailableGoals(data.filter(g => g.id !== initialData?.id));
    } catch (error) {
      console.error('Error fetching available goals for dependencies:', error);
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    switch (step) {
      case 1:
        if (!goalData.title.trim()) newErrors.title = 'Title is required';
        if (!goalData.description.trim()) newErrors.description = 'Description is required';
        if (!goalData.targetCriteria.targetValue)
          newErrors.targetValue = 'Target value is required';
        break;

      case 2:
        if (!goalData.smartCriteria.specific.trim())
          newErrors.specific = 'Specific criteria is required';
        if (!goalData.smartCriteria.measurable.trim())
          newErrors.measurable = 'Measurable criteria is required';
        break;

      case 3:
        if (!goalData.targetDate) newErrors.targetDate = 'Target date is required';
        if (new Date(goalData.targetDate) <= new Date(goalData.startDate)) {
          newErrors.targetDate = 'Target date must be after start date';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const createGoal = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);
      // Strip empty strings for optional FK fields so Prisma doesn't reject them
      const orUndefined = (v?: string) => (v && v.trim() !== '' ? v : undefined);
      const payload = {
        ...goalData,
        startDate: new Date(goalData.startDate).toISOString(),
        targetDate: new Date(goalData.targetDate).toISOString(),
        status: 'active',
        courseId: orUndefined(goalData.courseId),
        learningPathId: orUndefined(goalData.learningPathId),
        dependsOnGoalId: orUndefined(goalData.dependsOnGoalId),
      };
      await apiService.post(`/learning-goals`, payload);

      // Create a schedule event for the goal so it appears on the calendar
      if (goalData.targetDate) {
        try {
          const targetDate = new Date(goalData.targetDate);
          await apiService.post('/events', {
            title: `Goal: ${goalData.title}`,
            description: goalData.description || '',
            date: targetDate.toISOString(),
            endDate: targetDate.toISOString(),
            type: 'goal',
            location: goalData.category || 'Personal',
          });
        } catch {
          // Non-fatal: goal was still created successfully
          console.warn('Could not create calendar event for goal');
        }
      }

      onGoalCreated();
      onClose();
      resetForm();
    } catch (err: unknown) {
      const message = getErrorMessage(err) || 'Failed to create goal';
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setGoalData({
      title: '',
      description: '',
      type: 'shortTerm',
      category: 'custom',
      priority: 'medium',
      targetCriteria: {
        type: 'numeric',
        targetValue: 0,
        unit: '',
        measurementMethod: '',
      },
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      learningPathId: '',
      courseId: '',
      smartCriteria: {
        specific: '',
        measurable: '',
        achievable: '',
        relevant: '',
        timeBound: '',
      },
      milestones: [] as Milestone[],
      reminderSettings: {
        enabled: true,
        frequency: 'daily' as const,
        time: '09:00',
      },
      progressTracking: {
        autoTracking: false,
        manualUpdates: true,
        dataSources: [] as string[],
        updateFrequency: 'manual' as const,
      },
      dependsOnGoalId: '',
      status: 'active',
    });
    setErrors({});
    setSmartSuggestions(null);
  };

  const addMilestone = () => {
    const newMilestone = {
      title: '',
      description: '',
      targetDate: goalData.targetDate || goalData.startDate,
      targetValue: goalData.targetCriteria.targetValue / 2,
      order: goalData.milestones.length,
    };
    setGoalData(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMilestone],
    }));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: Milestone[keyof Milestone]) => {
    setGoalData(prev => ({
      ...prev,
      milestones: prev.milestones.map((milestone, i) =>
        i === index ? { ...milestone, [field]: value } : milestone
      ),
    }));
  };

  const removeMilestone = (index: number) => {
    setGoalData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title *</label>
        <input
          type="text"
          value={goalData.title}
          onChange={e => setGoalData(prev => ({ ...prev, title: e.target.value }))}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.title ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="e.g., Complete USMLE Step 1 preparation"
        />
        {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
        <textarea
          value={goalData.description}
          onChange={e => setGoalData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.description ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Describe what you want to achieve and why it's important"
        />
        {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={goalData.category}
            onChange={e => setGoalData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Goal Category"
          >
            <option value="study_time">Study Time</option>
            <option value="course_completion">Course Completion</option>
            <option value="assessment_score">Assessment Score</option>
            <option value="skill_mastery">Skill Mastery</option>
            <option value="streak_maintenance">Streak Maintenance</option>
            <option value="learning_path">Learning Path</option>
            <option value="clinical_cases">Clinical Cases</option>
            <option value="personal">Personal</option>
            <option value="academic">Academic</option>
            <option value="professional">Professional</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <select
            value={goalData.priority}
            onChange={e => setGoalData(prev => ({ ...prev, priority: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Goal Priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Goal Type</label>
          <select
            value={goalData.type}
            onChange={e => setGoalData(prev => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Goal Type"
          >
            <option value="shortTerm">Short-Term</option>
            <option value="longTerm">Long-Term</option>
            <option value="recurring">Recurring</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Value *</label>
          <input
            type="number"
            value={goalData.targetCriteria.targetValue}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                targetCriteria: {
                  ...prev.targetCriteria,
                  targetValue: parseFloat(e.target.value) || 0,
                },
              }))
            }
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.targetValue ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="100"
          />
          {errors.targetValue && (
            <p className="text-red-600 text-sm mt-1">{errors.targetValue}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
          <input
            type="text"
            value={goalData.targetCriteria.unit}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                targetCriteria: { ...prev.targetCriteria, unit: e.target.value },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="hours, points, %"
            title="Unit of Measurement"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Measurement Type</label>
          <select
            value={goalData.targetCriteria.type}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                targetCriteria: { ...prev.targetCriteria, type: e.target.value },
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Measurement Type"
          >
            <option value="numeric">Numeric</option>
            <option value="percentage">Percentage</option>
            <option value="boolean">Yes/No</option>
            <option value="completion">Completion</option>
            <option value="score">Score</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">SMART Goal Framework</h4>
            <p className="text-blue-800 text-sm">
              Make your goal Specific, Measurable, Achievable, Relevant, and Time-bound for better
              success.
            </p>
          </div>
        </div>
      </div>

      {smartSuggestions && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Star className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 mb-1">AI Suggestions Generated</h4>
              <p className="text-green-800 text-sm">
                We've generated SMART criteria suggestions based on your goal. Feel free to
                customize them.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specific - What exactly will you accomplish? *
          </label>
          <textarea
            value={goalData.smartCriteria.specific}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                smartCriteria: { ...prev.smartCriteria, specific: e.target.value },
              }))
            }
            rows={2}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.specific ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Be specific about what you want to achieve"
          />
          {errors.specific && <p className="text-red-600 text-sm mt-1">{errors.specific}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Measurable - How will you measure progress? *
          </label>
          <textarea
            value={goalData.smartCriteria.measurable}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                smartCriteria: { ...prev.smartCriteria, measurable: e.target.value },
              }))
            }
            rows={2}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.measurable ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Define how you'll track and measure success"
          />
          {errors.measurable && <p className="text-red-600 text-sm mt-1">{errors.measurable}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Achievable - Is this goal realistic?
          </label>
          <textarea
            value={goalData.smartCriteria.achievable}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                smartCriteria: { ...prev.smartCriteria, achievable: e.target.value },
              }))
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Explain why this goal is achievable for you"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Relevant - Why is this goal important?
          </label>
          <textarea
            value={goalData.smartCriteria.relevant}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                smartCriteria: { ...prev.smartCriteria, relevant: e.target.value },
              }))
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Connect this goal to your broader objectives"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time-bound - When will you complete this?
          </label>
          <textarea
            value={goalData.smartCriteria.timeBound}
            onChange={e =>
              setGoalData(prev => ({
                ...prev,
                smartCriteria: { ...prev.smartCriteria, timeBound: e.target.value },
              }))
            }
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Set a specific deadline and timeline"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={goalData.startDate}
            onChange={e => setGoalData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Goal Start Date"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Date *</label>
          <input
            type="date"
            value={goalData.targetDate}
            onChange={e => setGoalData(prev => ({ ...prev, targetDate: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.targetDate ? 'border-red-300' : 'border-gray-300'
            }`}
            title="Goal Target Date"
          />
          {errors.targetDate && <p className="text-red-600 text-sm mt-1">{errors.targetDate}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Pre-requisite (Depends On)</label>
        <select
          value={goalData.dependsOnGoalId}
          onChange={e => setGoalData(prev => ({ ...prev, dependsOnGoalId: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          title="Dependency Goal"
        >
          <option value="">None (Independent)</option>
          {availableGoals.map(g => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Blocking logic and deadline cascading will apply if a pre-requisite is selected.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-gray-900">Milestones</h4>
          <button
            type="button"
            onClick={addMilestone}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            + Add Milestone
          </button>
        </div>

        {goalData.milestones.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              Add milestones to break your goal into smaller, manageable steps
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {goalData.milestones.map((milestone, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h5 className="font-medium text-gray-900">Milestone {index + 1}</h5>
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="text-red-600 hover:text-red-700"
                    aria-label="Remove milestone"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={milestone.title}
                      onChange={e => updateMilestone(index, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Milestone title"
                      title="Milestone Title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Date
                    </label>
                    <input
                      type="date"
                      value={milestone.targetDate}
                      onChange={e => updateMilestone(index, 'targetDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      title="Milestone Target Date"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Value
                  </label>
                  <input
                    type="number"
                    value={milestone.targetValue}
                    onChange={e =>
                      updateMilestone(index, 'targetValue', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Target value for this milestone"
                    title="Milestone Target Value"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Progress Tracking</h4>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="manualUpdates"
              checked={goalData.progressTracking.manualUpdates}
              onChange={e =>
                setGoalData(prev => ({
                  ...prev,
                  progressTracking: {
                    ...prev.progressTracking,
                    manualUpdates: e.target.checked,
                  },
                }))
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="manualUpdates" className="text-sm font-medium text-gray-700">
              Allow manual progress updates
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoTracking"
              checked={goalData.progressTracking.autoTracking}
              onChange={e =>
                setGoalData(prev => ({
                  ...prev,
                  progressTracking: { ...prev.progressTracking, autoTracking: e.target.checked },
                }))
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autoTracking" className="text-sm font-medium text-gray-700">
              Enable automatic progress tracking (when possible)
            </label>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Reminders</h4>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="remindersEnabled"
              checked={goalData.reminderSettings.enabled}
              onChange={e =>
                setGoalData(prev => ({
                  ...prev,
                  reminderSettings: { ...prev.reminderSettings, enabled: e.target.checked },
                }))
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="remindersEnabled" className="text-sm font-medium text-gray-700">
              Enable goal reminders
            </label>
          </div>

          {goalData.reminderSettings.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={goalData.reminderSettings.frequency}
                  onChange={e =>
                    setGoalData(prev => ({
                      ...prev,
                      reminderSettings: {
                        ...prev.reminderSettings,
                        frequency: e.target.value as typeof prev.reminderSettings.frequency,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Reminder Frequency"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={goalData.reminderSettings.time}
                  onChange={e =>
                    setGoalData(prev => ({
                      ...prev,
                      reminderSettings: { ...prev.reminderSettings, time: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Reminder Time"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Goal Summary</h4>

        <div className="space-y-4">
          <div>
            <h5 className="font-medium text-gray-700">Title</h5>
            <p className="text-gray-900">{goalData.title}</p>
          </div>

          <div>
            <h5 className="font-medium text-gray-700">Description</h5>
            <p className="text-gray-900">{goalData.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-gray-700">Target</h5>
              <p className="text-gray-900">
                {goalData.targetCriteria.targetValue} {goalData.targetCriteria.unit}
              </p>
            </div>

            <div>
              <h5 className="font-medium text-gray-700">Deadline</h5>
              <p className="text-gray-900">{new Date(goalData.targetDate).toLocaleDateString()}</p>
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-700">Priority</h5>
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                goalData.priority === 'critical'
                  ? 'bg-red-100 text-red-800'
                  : goalData.priority === 'high'
                    ? 'bg-orange-100 text-orange-800'
                    : goalData.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
              }`}
            >
              {goalData.priority}
            </span>
          </div>

          {goalData.milestones.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-700">Milestones</h5>
              <ul className="list-disc list-inside text-gray-900 space-y-1">
                {goalData.milestones.map((milestone, index) => (
                  <li key={index}>{milestone.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-800">{errors.general}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div className="relative z-10 inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create Learning Goal</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close goal creation wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      currentStep >= step.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 text-gray-500'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-2 ${
                        currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-medium text-gray-900">{steps[currentStep - 1].title}</h3>
              <p className="text-sm text-gray-600">{steps[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Step content */}
          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 1
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>

              {currentStep < steps.length ? (
                <button
                  onClick={nextStep}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={createGoal}
                  disabled={loading}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>Create Goal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
