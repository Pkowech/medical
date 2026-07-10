'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import {
  User,
  Heart,
  Activity,
  Thermometer,
  Clock,
  CheckCircle,
  AlertCircle,
  Stethoscope,
  FileText,
  Brain,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiService } from '@/features/auth/services/apiClient';

interface PatientInfo {
  age: number;
  gender: string;
  chief_complaint: string;
  history_of_present_illness: string;
  past_medical_history?: string[];
  medications?: string[];
  allergies?: string[];
  social_history?: string;
  family_history?: string;
  vital_signs?: {
    temperature?: string;
    blood_pressure?: string;
    heart_rate?: string;
    respiratory_rate?: string;
    oxygen_saturation?: string;
    weight?: string;
    height?: string;
  };
}

interface CaseSection {
  id: string;
  type: 'history' | 'physical_exam' | 'diagnostics' | 'treatment' | 'follow_up';
  title: string;
  content: string;
  order: number;
  is_unlocked_initially?: boolean;
  unlock_conditions?: string[];
  points?: number;
}

interface DecisionPoint {
  id: string;
  section_id: string;
  question: string;
  options: {
    id: string;
    text: string;
    is_correct: boolean;
    feedback: string;
    consequences?: string;
    unlocks_sections?: string[];
    points?: number;
  }[];
  type: 'single_choice' | 'multiple_choice' | 'ranking';
  required: boolean;
}

interface ClinicalCase {
  id: string;
  title: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  specialty: string;
  estimated_duration_minutes: number;
  learning_objectives: string[];
  patient_info: PatientInfo;
  case_flow: {
    sections: CaseSection[];
    decision_points: DecisionPoint[];
  };
}

interface CaseAttempt {
  id: string;
  status: 'inProgress' | 'completed' | 'abandoned';
  score: number;
  max_score: number;
  percentage: number;
  progress: {
    current_section: string;
    completed_sections: string[];
    unlocked_sections: string[];
    decisions_made: {
      decision_point_id: string;
      selected_option_id: string;
      timestamp: Date;
      points_earned: number;
    }[];
    section_times: {
      section_id: string;
      time_spent: number;
    }[];
  };
}

interface InteractiveCaseInterfaceProps {
  caseId: string;
  onComplete?: (attempt: CaseAttempt) => void;
}

export function InteractiveCaseInterface({ caseId, onComplete: _onComplete }: InteractiveCaseInterfaceProps) {
  const [clinicalCase, setClinicalCase] = useState<ClinicalCase | null>(null);
  const [attempt, setAttempt] = useState<CaseAttempt | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [sectionStartTime, setSectionStartTime] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<ClinicalCase>(`/clinical-cases/${caseId}`);
      const caseData = response.data;
      setClinicalCase(caseData);

      // Check if user has an active attempt
      const attemptData = (caseData as { current_attempt?: CaseAttempt }).current_attempt;
      if (attemptData) {
        setAttempt(attemptData);
        setCurrentSection(attemptData.progress.current_section);
      } else {
        // Start new attempt
        await startNewAttempt();
      }
    } catch (error) {
      console.error('Failed to load case:', error);
      toast.error('Failed to load clinical case');
    } finally {
      setLoading(false);
    }
  };

  const startNewAttempt = async () => {
    try {
      const response = await apiService.post<CaseAttempt>('/clinical-cases/attempts', {
        case_id: caseId,
      });
      const newAttempt = response.data;
      setAttempt(newAttempt);
      setCurrentSection(newAttempt.progress.current_section);
      setSectionStartTime(Date.now());
    } catch (error) {
      console.error('Failed to start attempt:', error);
      toast.error('Failed to start case attempt');
    }
  };

  const submitDecision = async (decisionPointId: string, selectedOptionIds: string[]) => {
    if (!attempt) return;

    try {
      const timeSpent = Math.floor((Date.now() - sectionStartTime) / 1000);

      const response = await apiService.patch<CaseAttempt>(
        `/clinical-cases/attempts/${attempt.id}/progress`,
        {
          current_section: currentSection,
          decision_point_id: decisionPointId,
          selected_option_id: selectedOptionIds[0], // For now, handle single selection
          time_spent: timeSpent,
        }
      );

      const updatedAttempt = response.data;
      setAttempt(updatedAttempt);
      setShowFeedback(prev => ({ ...prev, [decisionPointId]: true }));

      // Check if new sections are unlocked
      const decisionPoint = clinicalCase?.case_flow.decision_points.find(
        dp => dp.id === decisionPointId
      );
      const selectedOption = decisionPoint?.options.find(opt =>
        selectedOptionIds.includes(opt.id)
      );

      if (selectedOption?.unlocks_sections) {
        toast.success('New sections unlocked!');
      }
    } catch (error) {
      console.error('Failed to submit decision:', error);
      toast.error('Failed to submit decision');
    }
  };

  const navigateToSection = (sectionId: string) => {
    if (!attempt || !attempt.progress.unlocked_sections.includes(sectionId)) {
      toast.error('This section is not yet unlocked');
      return;
    }

    setCurrentSection(sectionId);
    setSectionStartTime(Date.now());
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'complex':
        return 'bg-orange-100 text-orange-800';
      case 'expert':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'history':
        return <FileText className="h-4 w-4" />;
      case 'physical_exam':
        return <Stethoscope className="h-4 w-4" />;
      case 'diagnostics':
        return <Activity className="h-4 w-4" />;
      case 'treatment':
        return <Heart className="h-4 w-4" />;
      case 'follow_up':
        return <Clock className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-pulse" />
            <h3 className="text-lg font-medium mb-2">Loading Clinical Case</h3>
            <p className="text-gray-600">Preparing your interactive medical scenario...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clinicalCase || !attempt) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-medium mb-2">Case Not Available</h3>
          <p className="text-gray-600">Unable to load the clinical case.</p>
        </CardContent>
      </Card>
    );
  }

  const currentSectionData = clinicalCase.case_flow.sections.find(s => s.id === currentSection);
  const sectionDecisionPoints = clinicalCase.case_flow.decision_points.filter(
    dp => dp.section_id === currentSection
  );
  const progress =
    (attempt.progress.completed_sections.length / clinicalCase.case_flow.sections.length) * 100;

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl mb-2">{clinicalCase.title}</CardTitle>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={getComplexityColor(clinicalCase.complexity)}>
                  {clinicalCase.complexity}
                </Badge>
                <Badge variant="outline">{clinicalCase.specialty}</Badge>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Timer className="h-4 w-4" />
                  {clinicalCase.estimated_duration_minutes} min
                </div>
              </div>
              <p className="text-gray-600">{clinicalCase.description}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {attempt.percentage.toFixed(0)}%
              </div>
              <p className="text-sm text-gray-600">Score</p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Patient Information Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Demographics</h4>
                <p className="text-sm text-gray-600">
                  {clinicalCase.patient_info.age} year old {clinicalCase.patient_info.gender}
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Chief Complaint</h4>
                <p className="text-sm text-gray-600">{clinicalCase.patient_info.chief_complaint}</p>
              </div>

              {clinicalCase.patient_info.vital_signs && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Vital Signs</h4>
                  <div className="space-y-1 text-sm">
                    {clinicalCase.patient_info.vital_signs.temperature && (
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-3 w-3" />
                        <span>Temp: {clinicalCase.patient_info.vital_signs.temperature}</span>
                      </div>
                    )}
                    {clinicalCase.patient_info.vital_signs.blood_pressure && (
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        <span>BP: {clinicalCase.patient_info.vital_signs.blood_pressure}</span>
                      </div>
                    )}
                    {clinicalCase.patient_info.vital_signs.heart_rate && (
                      <div className="flex items-center gap-2">
                        <Heart className="h-3 w-3" />
                        <span>HR: {clinicalCase.patient_info.vital_signs.heart_rate}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section Navigation */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Case Sections</h4>
                <div className="space-y-1">
                  {clinicalCase.case_flow.sections
                    .sort((a, b) => a.order - b.order)
                    .map(section => {
                      const isUnlocked = attempt.progress.unlocked_sections.includes(section.id);
                      const isCompleted = attempt.progress.completed_sections.includes(section.id);
                      const isCurrent = currentSection === section.id;

                      return (
                        <button
                          key={section.id}
                          onClick={() => navigateToSection(section.id)}
                          disabled={!isUnlocked}
                          className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors ${
                            isCurrent
                              ? 'bg-blue-100 text-blue-900'
                              : isUnlocked
                                ? 'hover:bg-gray-100 text-gray-700'
                                : 'text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {getSectionIcon(section.type)}
                          <span className="flex-1">{section.title}</span>
                          {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Case Content */}
        <div className="lg:col-span-3">
          {currentSectionData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getSectionIcon(currentSectionData.type)}
                  {currentSectionData.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: currentSectionData.content }} />
                </div>

                {/* Decision Points */}
                {sectionDecisionPoints.map(decisionPoint => (
                  <Card key={decisionPoint.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-500" />
                        Decision Point
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="font-medium text-gray-900">{decisionPoint.question}</p>

                      <div className="space-y-3">
                        {decisionPoint.options.map(option => {
                          const isSelected = selectedAnswers[decisionPoint.id]?.includes(option.id);
                          const showingFeedback = showFeedback[decisionPoint.id];

                          return (
                            <div key={option.id} className="space-y-2">
                              <label
                                className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? showingFeedback
                                      ? option.is_correct
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-red-500 bg-red-50'
                                      : 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type={
                                    decisionPoint.type === 'single_choice' ? 'radio' : 'checkbox'
                                  }
                                  name={decisionPoint.id}
                                  value={option.id}
                                  checked={isSelected}
                                  onChange={e => {
                                    if (decisionPoint.type === 'single_choice') {
                                      setSelectedAnswers(prev => ({
                                        ...prev,
                                        [decisionPoint.id]: [option.id],
                                      }));
                                    } else {
                                      setSelectedAnswers(prev => {
                                        const current = prev[decisionPoint.id] || [];
                                        return {
                                          ...prev,
                                          [decisionPoint.id]: e.target.checked
                                            ? [...current, option.id]
                                            : current.filter(id => id !== option.id),
                                        };
                                      });
                                    }
                                  }}
                                  disabled={showingFeedback}
                                  className="sr-only"
                                />
                                <div className="flex-1">
                                  <span className="text-gray-900">{option.text}</span>
                                  {showingFeedback && isSelected && (
                                    <div
                                      className={`mt-2 p-3 rounded ${
                                        option.is_correct
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {option.is_correct ? (
                                          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        ) : (
                                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        )}
                                        <span className="text-sm">{option.feedback}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>

                      {!showFeedback[decisionPoint.id] && (
                        <Button
                          onClick={() =>
                            submitDecision(
                              decisionPoint.id,
                              selectedAnswers[decisionPoint.id] || []
                            )
                          }
                          disabled={!selectedAnswers[decisionPoint.id]?.length}
                          className="w-full"
                        >
                          Submit Decision
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
