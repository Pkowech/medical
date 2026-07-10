'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Play,
  Download,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  CheckCircle,
  Clock,
  AlertCircle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { topicService, Topic } from '@/features/courses/services/topicService';
import materialService from '@/features/courses/services/materialService';
import progressService from '@/features/learning-management/services/progressService';
import { quizProgressIntegration } from '@/features/learning-management/services/quizProgressIntegration';
import { useSession } from 'next-auth/react';
import { Material } from '@/shared/types/materialInterface';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { useCourseProgressStore } from '@/features/courses/hooks/useCourseProgressStore';
import { MaterialPreviewModal } from './MaterialPreviewModal';
import { TopicQuiz } from './TopicQuiz';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';
import { Brain } from 'lucide-react';

interface TopicViewerProps {
  courseId: string;
  unitId: string;
  topicId: string;
}

const MATERIAL_ICONS: Record<string, React.ReactNode> = {
  VIDEO: <Play className="w-5 h-5" />,
  PDF: <FileText className="w-5 h-5" />,
  DOCUMENT: <FileText className="w-5 h-5" />,
  ARTICLE: <FileText className="w-5 h-5" />,
  INTERACTIVE: <Lightbulb className="w-5 h-5" />,
  QUIZ: <BookOpen className="w-5 h-5" />,
};

const getMaterialIcon = (type: string) => MATERIAL_ICONS[type?.toUpperCase()] || <Download className="w-5 h-5" />;
const getMaterialColor = (type: string): string => {
  const types: Record<string, string> = {
    VIDEO: 'from-blue-500 to-blue-600',
    PDF: 'from-red-500 to-red-600',
    DOCUMENT: 'from-orange-500 to-orange-600',
    ARTICLE: 'from-green-500 to-green-600',
    INTERACTIVE: 'from-purple-500 to-purple-600',
    QUIZ: 'from-pink-500 to-pink-600',
  };
  return types[type?.toUpperCase()] || 'from-gray-500 to-gray-600';
};

export const TopicViewer: React.FC<TopicViewerProps> = ({ courseId, unitId, topicId }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const { setHeader } = usePageHeader();
  const { toggleBookmark, bookmarks, markLessonComplete, progress } = useCourseProgressStore();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const isBookmarked = bookmarks.includes(topicId);
  const isCompleted = progress[topicId];

  // Fetch topic data
  useEffect(() => {
    const fetchTopic = async () => {
      try {
        setIsLoading(true);
        const topicData = await topicService.getTopicById(topicId);
        setTopic(topicData);

        // Set page header
        setHeader({
          title: topicData.title || 'Topic',
          description: topicData.description || 'Learning material',
          icon: '📖',
        });

        // Fetch materials for this topic
        if (topicData.materials && Array.isArray(topicData.materials)) {
          setMaterials(topicData.materials);
        } else {
          // Try to fetch materials separately
          try {
            const mats = await materialService.getMaterialsByTopicId(topicId);
            setMaterials(mats || []);
          } catch (err) {
            console.warn('Could not fetch materials:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching topic:', error);
        toast.error('Failed to load topic');
      } finally {
        setIsLoading(false);
      }
    };

    if (topicId) {
      fetchTopic();
    }
  }, [topicId, setHeader]);

  const handleOpenMaterial = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setShowMaterialModal(true);
  };

  const handleCloseMaterial = async () => {
    setShowMaterialModal(false);
    
    // Track material as viewed
    if (selectedMaterialId) {
      try {
        await progressService.updateUnitProgress(
          selectedMaterialId,
          'completed',
          100,
          0,
          `Studied material in topic ${topicId}`
        );
      } catch (error) {
        console.error('Error tracking material progress:', error);
      }
    }
    
    setSelectedMaterialId(null);
  };

  const handleToggleBookmark = () => {
    toggleBookmark(topicId);
    toast.success(isBookmarked ? 'Removed from bookmarks' : 'Added to bookmarks');
  };

  const handleMarkComplete = () => {
    markLessonComplete(topicId);
    toast.success('Topic marked as complete!');
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleNavigateToUnit = () => {
    router.push(`/courses/${courseId}/units/${unitId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">Loading topic...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Topic not found</h2>
            <p className="text-slate-600 dark:text-slate-400">The topic you're looking for doesn't exist.</p>
            <Button onClick={handleGoBack} variant="outline">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header with Navigation */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoBack}
                className="flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {topic.title}
                </h1>
                {topic.isMandatory && (
                  <Badge variant="secondary" className="mt-1">
                    Mandatory
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isCompleted && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 px-3 py-1.5 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Done</span>
                </div>
              )}
              <Button
                variant={isBookmarked ? 'default' : 'outline'}
                size="icon"
                onClick={handleToggleBookmark}
                className="flex-shrink-0"
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Topic Description */}
        {topic.description && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Overview
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {topic.description}
            </p>
          </div>
        )}

        {/* Materials Section */}
        {materials.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Study Materials
              </h2>
              <Badge variant="outline">{materials.length}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow group cursor-pointer"
                  onClick={() => handleOpenMaterial(material.id)}
                >
                  {/* Material Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getMaterialColor(material.type || 'DOCUMENT')} flex items-center justify-center text-white`}>
                      {getMaterialIcon(material.type || 'DOCUMENT')}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {material.type || 'DOCUMENT'}
                    </Badge>
                  </div>

                  {/* Material Info */}
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {material.title}
                  </h3>

                  {material.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                      {material.description}
                    </p>
                  )}

                  {/* Material Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      {material.duration && (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{material.duration} min</span>
                        </>
                      )}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenMaterial(material.id);
                      }}
                      className="group-hover:shadow-lg transition-shadow"
                    >
                      Study Now →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              No materials available for this topic yet
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleNavigateToUnit}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Unit
          </Button>
          {!isCompleted && (
            <Button
            onClick={() => setShowQuiz(true)}
              className="flex items-center gap-2"
            >
              <Brain className="w-4 h-4" />
              Take Topic Quiz
            </Button>
          )}
        </div>
      </div>

      {/* Topic Quiz Modal */}
      <TopicQuiz
        topicId={topicId}
        unitId={unitId}
        courseId={courseId}
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
        onComplete={async (score) => {
          setQuizScore(score);
          markLessonComplete(topicId);
          setShowQuiz(false);
          toast.success(`Great! You scored ${score}% on this topic quiz`);
          
          // Trigger multilayer integration: Quiz → Progress → Recommendations → Spaced Rep
          if (session?.user?.id) {
            try {
              await quizProgressIntegration.handleQuizCompletion({
                userId: session.user.id,
                topicId,
                unitId,
                courseId,
                score,
                timestamp: Date.now(),
              });
            } catch (error) {
              console.error('Error in quiz completion integration:', error);
              // Still show success even if integration fails - user saw their score
            }
          }
        }}
      />

      {/* Material Preview Modal */}
      <MaterialPreviewModal
        materialId={selectedMaterialId}
        isOpen={showMaterialModal}
        onClose={handleCloseMaterial}
      />
    </div>
  );
};
