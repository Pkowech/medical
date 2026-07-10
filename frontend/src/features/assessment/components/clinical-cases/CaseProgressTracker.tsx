'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Button } from '@/shared/components/ui/button';
import {
  Clock,
  CheckCircle,
  Circle,
  Target,
  FileText,
  Stethoscope,
  Activity,
  Heart,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface CaseProgress {
  case_id: string;
  case_title: string;
  attempt_id: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: Date;
  completed_at?: Date;
  total_time_spent: number;
  current_section: string;
  completed_sections: string[];
  total_sections: number;
  score: number;
  max_score: number;
  percentage: number;
  decisions_made: {
    decision_point_id: string;
    selected_option_id: string;
    timestamp: Date;
    points_earned: number;
    is_optimal: boolean;
  }[];
  section_performance: {
    section_id: string;
    section_title: string;
    section_type: string;
    time_spent: number;
    points_earned: number;
    max_points: number;
    completion_percentage: number;
  }[];
  learning_objectives_progress: {
    objective: string;
    progress: number;
    evidence: string[];
  }[];
  clinical_skills_assessment: {
    history_taking: number;
    physical_examination: number;
    diagnostic_reasoning: number;
    treatment_planning: number;
    communication: number;
    professionalism: number;
  };
}

interface CaseProgressTrackerProps {
  userId: string;
  caseId?: string;
  attemptId?: string;
  showDetailedAnalytics?: boolean;
}

export function CaseProgressTracker({
  userId,
  caseId,
  attemptId,
  showDetailedAnalytics = false,
}: CaseProgressTrackerProps) {
  const [progress, setProgress] = useState<CaseProgress[]>([]);
  const [selectedProgress, setSelectedProgress] = useState<CaseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    loadProgress();
  }, [userId, caseId, attemptId, timeframe]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (caseId) params.append('caseId', caseId);
      if (attemptId) params.append('attemptId', attemptId);
      params.append('timeframe', timeframe);

      const response = await fetch(`/api/clinical-cases/progress?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const progressData = await response.json();
        setProgress(Array.isArray(progressData) ? progressData : [progressData]);
        if (progressData.length > 0) {
          setSelectedProgress(progressData[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'inProgress':
        return 'bg-blue-100 text-blue-800';
      case 'abandoned':
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
        return <Circle className="h-4 w-4" />;
    }
  };

  const calculateOverallProgress = (progressItem: CaseProgress): number => {
    return (progressItem.completed_sections.length / progressItem.total_sections) * 100;
  };

  const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium mb-2">No Progress Data</h3>
          <p className="text-gray-600">
            Start working on clinical cases to see your progress here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Timeframe:</span>
        {(['week', 'month', 'all'] as const).map(period => (
          <Button
            key={period}
            variant={timeframe === period ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeframe(period)}
          >
            {period === 'all' ? 'All Time' : `Past ${period}`}
          </Button>
        ))}
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Cases Started</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{progress.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Completed</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {progress.filter(p => p.status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">Avg Score</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {progress.length > 0
                ? Math.round(progress.reduce((sum, p) => sum + p.percentage, 0) / progress.length)
                : 0}
              %
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">Total Time</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {formatTime(progress.reduce((sum, p) => sum + p.total_time_spent, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Case Progress */}
      <div className="space-y-4">
        {progress.map(progressItem => (
          <Card
            key={progressItem.attempt_id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedProgress(progressItem)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{progressItem.case_title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getStatusColor(progressItem.status)}>
                      {progressItem.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Started {new Date(progressItem.started_at).toLocaleDateString()}
                    </span>
                    {progressItem.completed_at && (
                      <span className="text-sm text-gray-600">
                        • Completed {new Date(progressItem.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-2xl font-bold ${getPerformanceColor(progressItem.percentage)}`}
                  >
                    {progressItem.percentage.toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-600">Score</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm text-gray-600">
                      {progressItem.completed_sections.length}/{progressItem.total_sections}{' '}
                      sections
                    </span>
                  </div>
                  <Progress value={calculateOverallProgress(progressItem)} className="h-2" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Time Spent</span>
                    <div className="font-medium">{formatTime(progressItem.total_time_spent)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Decisions Made</span>
                    <div className="font-medium">{progressItem.decisions_made.length}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Optimal Decisions</span>
                    <div className="font-medium">
                      {progressItem.decisions_made.filter(d => d.is_optimal).length}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Points Earned</span>
                    <div className="font-medium">
                      {progressItem.score}/{progressItem.max_score}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analytics */}
      {showDetailedAnalytics && selectedProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Detailed Analytics - {selectedProgress.case_title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Section Performance */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Section Performance</h4>
              <div className="space-y-3">
                {selectedProgress.section_performance.map(section => (
                  <div
                    key={section.section_id}
                    className="flex items-center gap-4 p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {getSectionIcon(section.section_type)}
                      <span className="font-medium">{section.section_title}</span>
                    </div>
                    <div className="text-sm text-gray-600">{formatTime(section.time_spent)}</div>
                    <div className="text-sm font-medium">
                      {section.points_earned}/{section.max_points} pts
                    </div>
                    <div className="w-24">
                      <Progress value={section.completion_percentage} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Learning Objectives Progress */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Learning Objectives</h4>
              <div className="space-y-3">
                {selectedProgress.learning_objectives_progress.map((objective, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{objective.objective}</span>
                      <Badge variant={objective.progress >= 80 ? 'default' : 'outline'}>
                        {objective.progress}%
                      </Badge>
                    </div>
                    <Progress value={objective.progress} className="h-2 mb-2" />
                    {objective.evidence.length > 0 && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Evidence: </span>
                        {objective.evidence.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical Skills Radar Chart */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Clinical Skills Assessment</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={[
                      {
                        skill: 'History Taking',
                        score: selectedProgress.clinical_skills_assessment.history_taking,
                      },
                      {
                        skill: 'Physical Exam',
                        score: selectedProgress.clinical_skills_assessment.physical_examination,
                      },
                      {
                        skill: 'Diagnostic Reasoning',
                        score: selectedProgress.clinical_skills_assessment.diagnostic_reasoning,
                      },
                      {
                        skill: 'Treatment Planning',
                        score: selectedProgress.clinical_skills_assessment.treatment_planning,
                      },
                      {
                        skill: 'Communication',
                        score: selectedProgress.clinical_skills_assessment.communication,
                      },
                      {
                        skill: 'Professionalism',
                        score: selectedProgress.clinical_skills_assessment.professionalism,
                      },
                    ]}
                  >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Clinical Skills"
                      dataKey="score"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
