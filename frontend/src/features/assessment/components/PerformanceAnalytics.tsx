'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import {
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Brain,
  Lightbulb,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { HighRiskTopicsCard } from '@/features/analytics/components/HighRiskTopicsCard';
import type { PerformanceData } from '@/shared/types/analyticsInterface';

interface PerformanceAnalyticsProps {
  userId: string;
  data: PerformanceData;
}

export function PerformanceAnalyticsContent({
  userId,
  data,
}: PerformanceAnalyticsProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50';
      case 'low':
        return 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
      default:
        return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-700';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      default:
        return <BookOpen className="h-4 w-4 text-gray-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const overallScore = data.totalAttempts !== 0 && typeof data.overallScore === 'number' && Number.isFinite(data.overallScore)
    ? data.overallScore
    : null;

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
      <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Target className="h-5 w-5 text-blue-500" />
            Overall Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className={`text-3xl font-bold ${getScoreColor(overallScore ?? 0)}`}>
                {overallScore === null ? 'No score yet' : `${overallScore.toFixed(1)}%`}
              </div>
              <p className="text-gray-600 dark:text-slate-400">Average Score</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {data.questionsAttempted ??
                  data.categoryBreakdown?.reduce((sum, cat) => sum + (cat.questionsAnswered || 0), 0) ??
                  0}
              </div>
              <p className="text-gray-600 dark:text-slate-400">Questions Attempted</p>
            </div>
          </div>
          <Progress value={overallScore ?? 0} className="h-3" />
        </CardContent>
      </Card>

      {/* High-Risk Topics (Spaced Repetition Analytics) */}
      <HighRiskTopicsCard userId={userId} />

      {/* Learning Trends */}
      {(data.learningTrends?.length ?? 0) > 0 && (
        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Learning Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.learningTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={date => new Date(date).toLocaleDateString()}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    labelFormatter={label =>
                      typeof label === 'string' || typeof label === 'number'
                        ? new Date(label).toLocaleDateString()
                        : ''
                    }
                    formatter={value => [`${value}%`, 'Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Breakdown */}
      <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Performance by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? data.categoryBreakdown.map((category, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-slate-200">{category.category}</h4>
                    <Badge variant="outline" className="dark:border-slate-700 dark:text-slate-400">{category.questionsAnswered} questions</Badge>
                  </div>
                  <div className={`font-semibold ${getScoreColor(category.score ?? 0)}`}>
                    {typeof category.score === 'number' && Number.isFinite(category.score)
                      ? `${category.score.toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
                <Progress value={category.score ?? 0} className="h-2" />
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Avg. time: {typeof category.averageTime === 'number' ? `${Math.round(category.averageTime)}s` : '—'}</span>
                  {(category.score ?? 0) >= 80 ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Strong area
                    </span>
                  ) : (category.score ?? 0) < 60 ? (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      Needs improvement
                    </span>
                  ) : null}
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500">No category-level response data yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Gaps */}
      {(data.knowledgeGaps?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-orange-500" />
              Knowledge Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.knowledgeGaps?.map((gap, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(gap.severity)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{gap.topic}</h4>
                    <Badge className={getSeverityColor(gap.severity)}>
                      {gap.severity} priority
                    </Badge>
                  </div>
                  <ul className="text-sm space-y-1">
                    {gap.recommendedActions.map((action, actionIndex) => (
                      <li key={actionIndex} className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Study Recommendations */}
      {(data.studyRecommendations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Study Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.studyRecommendations?.map((rec, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(rec.priority)}
                      <h4 className="font-medium">{rec.topic}</h4>
                    </div>
                    <div className="text-sm text-gray-600">~{rec.estimatedStudyTime} min</div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Recommended resources:</p>
                    <ul className="text-sm space-y-1">
                      {rec.resources.map((resource, resourceIndex) => (
                        <li key={resourceIndex} className="flex items-center gap-2">
                          <BookOpen className="h-3 w-3 text-gray-400" />
                          <span>{resource}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {(data.nextSteps?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.nextSteps?.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
