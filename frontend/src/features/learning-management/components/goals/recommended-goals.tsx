'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { 
  Lightbulb, 
  Target, 
  Clock, 
  BookOpen, 
  Trophy, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { apiService } from '@/features/auth/services/apiClient';
import { RecommendedGoal, RecommendedGoalsResponse } from '@/shared/types/learningGoalsInterface';

interface RecommendedGoalsProps {
  onAccept: (goal: RecommendedGoal) => void;
}

const RecommendedGoals: React.FC<RecommendedGoalsProps> = ({ onAccept }) => {
  const [recommendations, setRecommendations] = useState<RecommendedGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const response = await apiService.get<RecommendedGoalsResponse>('/learning-goals/recommendations');
        // response is ApiResponse<RecommendedGoalsResponse>
        // the actual recommendations are in response.data.recommendations
        const data = response.data;
        const recs = data?.recommendations ?? [];
        setRecommendations(recs);
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'study_time': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'course_completion': return <BookOpen className="w-5 h-5 text-green-500" />;
      case 'assessment_score': return <Trophy className="w-5 h-5 text-purple-500" />;
      case 'streak_maintenance': return <Sparkles className="w-5 h-5 text-orange-500" />;
      default: return <Target className="w-5 h-5 text-blue-500" />;
    }
  };

  const getGradient = (category: string) => {
    switch (category.toLowerCase()) {
      case 'study_time': return 'from-blue-50 to-indigo-50 border-blue-100';
      case 'course_completion': return 'from-green-50 to-emerald-50 border-green-100';
      case 'assessment_score': return 'from-purple-50 to-fuchsia-50 border-purple-100';
      case 'streak_maintenance': return 'from-orange-50 to-yellow-50 border-orange-100';
      default: return 'from-gray-50 to-slate-50 border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 mb-4" />
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden border-dashed">
            <CardContent className="p-4">
              <div className="flex items-start space-x-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-100 bg-red-50">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-red-600">Failed to load recommendations</p>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-2 text-red-700 hover:text-red-800 hover:bg-red-100">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Lightbulb className="mr-2 h-5 w-5 text-yellow-500 fill-yellow-50" />
          Recommended Goals
        </h2>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          AI Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {recommendations.map((rec, index) => (
          <Card 
            key={index} 
            className={`group hover:shadow-lg transition-all duration-300 border overflow-hidden bg-linear-to-br ${getGradient(rec.category)}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300 border border-inherit">
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{rec.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{rec.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-gray-600 border-gray-100">
                  {rec.category.replace('_', ' ')}
                </Badge>
                {rec.recommendationReason && (
                  <div className="text-xs text-blue-600 font-medium flex items-center bg-blue-100/50 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {rec.recommendationReason}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between pt-4 border-t border-inherit">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                  Source: {rec.recommendationSource}
                </span>
                <Button 
                  size="sm" 
                  onClick={() => onAccept(rec)}
                  className="bg-white hover:bg-blue-600 text-blue-600 hover:text-white border-blue-200 hover:border-blue-600 shadow-sm transition-all duration-300 group/btn"
                >
                  <span>Try this goal</span>
                  <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RecommendedGoals;
