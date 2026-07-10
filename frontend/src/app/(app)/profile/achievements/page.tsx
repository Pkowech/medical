'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/features/auth/services/apiClient';
import AppErrorBoundary from '@/features/security/components/AppErrorBoundary';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button'; // Standardized casing
import { toast } from 'sonner';
import { Trophy, Star, Target, Zap, BookOpen, Clock } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  completed: boolean;
  completedAt?: string;
  type: 'quiz' | 'study' | 'streak' | 'milestone';
  points: number;
}

interface AchievementStats {
  totalAchievements: number;
  completedAchievements: number;
  totalPoints: number;
  rank: string;
  nextRank: {
    name: string;
    pointsNeeded: number;
  };
}

export default function AchievementsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats>({
    totalAchievements: 0,
    completedAchievements: 0,
    totalPoints: 0,
    rank: 'Beginner',
    nextRank: {
      name: 'Intermediate',
      pointsNeeded: 100,
    },
  });

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const [achievementsResponse, statsResponse] = await Promise.all([
          apiService.get<Achievement[]>('/users/achievements'),
          apiService.get<AchievementStats>('/users/achievement-stats'),
        ]);
        setAchievements(achievementsResponse.data);
        setStats(statsResponse.data);
      } catch {
        toast.error('Failed to load achievements');
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  const getAchievementIcon = (type: Achievement['type']) => {
    switch (type) {
      case 'quiz':
        return <Target className="w-8 h-8 text-blue-500" />;
      case 'study':
        return <BookOpen className="w-8 h-8 text-green-500" />;
      case 'streak':
        return <Zap className="w-8 h-8 text-yellow-500" />;
      case 'milestone':
        return <Star className="w-8 h-8 text-purple-500" />;
      default:
        return <Trophy className="w-8 h-8 text-gray-500" />;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AppErrorBoundary>
      <div className="container mx-auto px-4 py-8 bg-gray-50/50 dark:bg-slate-900/50 min-h-screen">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Achievements</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center space-x-4">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Total Points</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPoints}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center space-x-4">
              <Star className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Current Rank</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.rank}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center space-x-4">
              <Target className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Achievements</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.completedAchievements}/{stats.totalAchievements}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center space-x-4">
              <Clock className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Next Rank</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.nextRank.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500">{stats.nextRank.pointsNeeded} pts left</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map(achievement => (
            <Card
              key={achievement.id}
              className={`p-6 transition-all bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 ${achievement.completed ? 'ring-1 ring-green-500/20 shadow-[0_0_15px_-3px_rgba(34,197,94,0.1)]' : ''}`}
            >
              <div className="flex items-start space-x-4">
                <div className="shrink-0">{getAchievementIcon(achievement.type)}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{achievement.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{achievement.description}</p>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-medium text-gray-400 dark:text-slate-500 mb-2">
                      <span>Progress</span>
                      <span>{achievement.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${achievement.progress}%` }}
                      />
                    </div>
                  </div>
                  {achievement.completed && (
                    <div className="mt-4 flex items-center text-sm font-medium text-green-600 dark:text-green-400">
                      <Trophy className="w-4 h-4 mr-1.5" />
                      Completed
                      {achievement.completedAt && (
                        <span className="ml-2 font-normal text-gray-400 dark:text-slate-500">
                          on {new Date(achievement.completedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex items-center text-xs font-medium text-gray-400 dark:text-slate-500">
                    <Star className="w-3.5 h-3.5 mr-1.5" />
                    {achievement.points} points
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {achievements.length === 0 && (
          <Card className="p-8 text-center bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Achievements Yet</h3>
            <p className="text-gray-500 dark:text-slate-400 mb-6">
              Start your learning journey to unlock badges and milestones!
            </p>
            <Button onClick={() => router.push('/courses')}>
              Start Learning
            </Button>
          </Card>
        )}
      </div>
    </AppErrorBoundary>
  );
}
