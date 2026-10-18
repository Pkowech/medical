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
      <Card className="border-destructive/30 bg-destructive/10 text-destructive">
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
        <h2 className="text-xl font-bold text-foreground flex items-center">
          <Lightbulb className="mr-2 h-5 w-5 text-yellow-500 fill-yellow-50" />
          Recommended Goals
        </h2>
        <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">
          AI Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {recommendations.map((rec, index) => (
          <Card 
            key={index} 
            className="group hover:shadow-lg transition-all duration-300 border border-border overflow-hidden bg-card text-card-foreground"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-background rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300 border border-border">
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{rec.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{rec.description}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-secondary/80 backdrop-blur-sm text-secondary-foreground border-border">
                  {rec.category.replace('_', ' ')}
                </Badge>
                {rec.recommendationReason && (
                  <div className="text-xs text-primary font-medium flex items-center bg-primary/10 px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {rec.recommendationReason}
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between pt-4 border-t border-inherit">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Source: {rec.recommendationSource}
                </span>
                <Button 
                  size="sm" 
                  onClick={() => onAccept(rec)}
                  className="bg-card hover:bg-primary text-primary hover:text-primary-foreground border-border hover:border-primary shadow-sm transition-all duration-300 group/btn"
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
