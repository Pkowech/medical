'use client';

import React, { useState, useEffect } from 'react';
import ProgressBar from '@/shared/components/ui/ProgressBar';
import Link from 'next/link';
import {
  Route,
  TrendingUp,
  Clock,
  ChevronRight,
  Play,
  CheckCircle,
  Award,
  Trash2,
} from 'lucide-react';
import { LearningPathProgress } from '@/shared/types/learningInterface';
import { learningPathService } from '@/features/learning-management/services/learningPathService';
import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alertdialog';
import { toast } from 'sonner';

export const LearningPathProgressWidget: React.FC = () => {
  const [pathProgress, setPathProgress] = useState<LearningPathProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pathToDelete, setPathToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchPathProgress();
  }, []);

  const fetchPathProgress = async () => {
    try {
      const data = await learningPathService.getMyProgress();
      if (Array.isArray(data)) {
        setPathProgress(data.slice(0, 3)); // Show top 3 active paths
      } else {
        console.error('API response is not an array:', data);
      }
    } catch (error) {
      console.error('Error fetching learning path progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteLearningPath = async (learningPathId: string) => {
    try {
      await learningPathService.completeLearningPath(learningPathId);
      toast.success('Learning path marked as complete!');
      fetchPathProgress(); // Re-fetch to update UI
    } catch (error) {
      toast.error('Failed to mark learning path as complete.');
      console.error('Error completing learning path:', error);
    }
  };

  const handleDeleteLearningPath = async () => {
    if (pathToDelete) {
      try {
        await learningPathService.deleteLearningPath(pathToDelete);
        toast.success('Learning path deleted successfully.');
        fetchPathProgress(); // Re-fetch to update UI
      } catch (error) {
        toast.error('Failed to delete learning path.');
        console.error('Error deleting learning path:', error);
      } finally {
        setIsDeleteDialogOpen(false);
        setPathToDelete(null);
      }
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inProgress':
        return 'text-blue-600 bg-blue-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Route className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Learning Paths</h3>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Route className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Learning Paths</h3>
        </div>
        <Link
          href="/learning-paths"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
        >
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {pathProgress.length === 0 ? (
        <div className="text-center py-8">
          <Route className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Active Learning Paths</h4>
          <p className="text-gray-500 mb-4">
            Start your structured learning journey with curated educational paths
          </p>
          <Link
            href="/learning-paths"
            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Route className="w-4 h-4" />
            <span>Browse Learning Paths</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {pathProgress.map(progress => (
            <Link
              key={progress.id}
              href={`/learning-paths/${progress.learningPath.id}`}
              className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{progress.learningPath.title}</h4>
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <span className="capitalize">
                      {progress.learningPath.category.replace('_', ' ')}
                    </span>
                    <span>•</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{progress.learningPath.estimatedDurationWeeks}w</span>
                    </div>
                    <span>•</span>
                    <span>Last active {formatTimeAgo(progress.lastAccessedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(progress.status)}`}
                  >
                    {progress.status
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, str => str.toUpperCase())}
                  </span>

                  {progress.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Play className="w-5 h-5 text-blue-600" />
                  )}

                  {progress.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCompleteLearningPath(progress.learningPath.id);
                      }}
                    >
                      Mark Complete
                    </Button>
                  )}

                  <AlertDialog open={isDeleteDialogOpen && pathToDelete === progress.learningPath.id} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPathToDelete(progress.learningPath.id);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your learning path progress
                          and remove the learning path from your dashboard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteLearningPath}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progress.overallProgressPercentage)}%</span>
                </div>
                <div className="w-full h-2">
                  <ProgressBar
                    value={progress.overallProgressPercentage}
                    className="h-2 rounded-full"
                    colorClass={progress.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'}
                  />
                </div>
              </div>

              {progress.milestonesAchieved.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Award className="w-4 h-4 text-yellow-600" />
                  <span>
                    {progress.milestonesAchieved.length} of{' '}
                    {progress.learningPath.milestones?.length || 0} milestones achieved
                  </span>
                </div>
              )}
            </Link>
          ))}

          <div className="pt-2 border-t border-gray-100">
            <Link
              href="/learning-paths"
              className="flex items-center justify-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium py-2"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Explore More Learning Paths</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
