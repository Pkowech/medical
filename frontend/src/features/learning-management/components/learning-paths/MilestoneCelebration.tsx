'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  Star,
  Trophy,
  Target,
  Gift,
  Share2,
  Download,
  X,
  Sparkles,
  Medal,
  Crown,
} from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  description: string;
  type: string;
  rewards?: {
    points?: number;
    badge_id?: string;
    certificate?: {
      template_id: string;
      title: string;
      description: string;
    };
    unlock_content?: {
      courses?: string[];
      assessments?: string[];
      clinical_cases?: string[];
    };
  };
  celebration_config?: {
    show_animation: boolean;
    animation_type: 'fireworks' | 'badge' | 'custom';
    message: string;
    auto_share: boolean;
  };
}

interface MilestoneCelebrationProps {
  milestone: Milestone;
  isVisible: boolean;
  onClose: () => void;
  onShare?: () => void;
  onDownloadCertificate?: () => void;
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestone,
  isVisible,
  onClose,
  onShare,
  onDownloadCertificate,
}) => {
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'celebrate' | 'exit'>('enter');


  useEffect(() => {
    if (!isVisible) return;

    setAnimationPhase('enter');

    const celebrateTimeout = window.setTimeout(() => setAnimationPhase('celebrate'), 1000);

    return () => {
      clearTimeout(celebrateTimeout);
    };
  }, [isVisible, milestone]);

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case 'phase_completion':
        return Trophy;
      case 'assessment_score':
        return Star;
      case 'time_based':
        return Target;
      case 'skill_mastery':
        return Medal;
      case 'streak_achievement':
        return Crown;
      default:
        return Award;
    }
  };

  const getAnimationClass = () => {
    switch (animationPhase) {
      case 'enter':
        return 'animate-bounce';
      case 'celebrate':
        return 'animate-pulse';
      case 'exit':
        return 'animate-fade-out';
      default:
        return '';
    }
  };



  const renderRewards = () => {
    if (!milestone.rewards) return null;

    return (
      <div className="space-y-4">
        {milestone.rewards.points && (
          <div className="flex items-center justify-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <Star className="w-5 h-5 text-yellow-600 fill-current" />
            <span className="font-medium text-yellow-800">
              +{milestone.rewards.points} Points Earned!
            </span>
          </div>
        )}

        {milestone.rewards.badge_id && (
          <div className="flex items-center justify-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Award className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">New Badge Unlocked!</span>
          </div>
        )}

        {milestone.rewards.certificate && (
          <div className="flex items-center justify-center space-x-2 bg-green-50 border border-green-200 rounded-lg p-3">
            <Trophy className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">Certificate Available!</span>
          </div>
        )}

        {milestone.rewards.unlock_content && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Gift className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-800">New Content Unlocked!</span>
            </div>
            <div className="text-sm text-purple-700 space-y-1">
              {milestone.rewards.unlock_content.courses &&
                milestone.rewards.unlock_content.courses.length > 0 && (
                  <div>• {milestone.rewards.unlock_content.courses.length} new courses</div>
                )}
              {milestone.rewards.unlock_content.assessments &&
                milestone.rewards.unlock_content.assessments.length > 0 && (
                  <div>• {milestone.rewards.unlock_content.assessments.length} new assessments</div>
                )}
              {milestone.rewards.unlock_content.clinical_cases &&
                milestone.rewards.unlock_content.clinical_cases.length > 0 && (
                  <div>
                    • {milestone.rewards.unlock_content.clinical_cases.length} new clinical cases
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  const Icon = getMilestoneIcon(milestone.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden ${getAnimationClass()}`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close milestone dialog"
          title="Close milestone dialog"
          className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" focusable="false" />
        </button>

        {/* Header with gradient background */}
        <div className="relative bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 p-8 text-center">
          <div className="absolute inset-0 bg-black bg-opacity-10"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 rounded-full mb-4 backdrop-blur-sm">
              <Icon className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Milestone Achieved!</h2>

            <div className="flex items-center justify-center space-x-1 text-yellow-300">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{milestone.title}</h3>
            <p className="text-gray-600">{milestone.description}</p>
          </div>

          {/* Custom celebration message */}
          {milestone.celebration_config?.message && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <p className="text-blue-800 font-medium">{milestone.celebration_config.message}</p>
              </div>
            </div>
          )}

          {/* Rewards */}
          {renderRewards()}

          {/* Action buttons */}
          <div className="flex space-x-3 mt-6">
            {milestone.rewards?.certificate && onDownloadCertificate && (
              <button
                onClick={onDownloadCertificate}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Certificate</span>
              </button>
            )}

            {onShare && (
              <button
                onClick={onShare}
                className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Achievement</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>


    </div>
  );
};

// Hook for managing milestone celebrations
export const useMilestoneCelebration = () => {
  const [celebrationQueue, setCelebrationQueue] = useState<Milestone[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<Milestone | null>(null);

  const addCelebration = (milestone: Milestone) => {
    setCelebrationQueue(prev => [...prev, milestone]);
  };

  const showNextCelebration = () => {
    if (celebrationQueue.length > 0 && !currentCelebration) {
      const [next, ...rest] = celebrationQueue;
      setCurrentCelebration(next);
      setCelebrationQueue(rest);
    }
  };

  const closeCelebration = () => {
    setCurrentCelebration(null);
    // Show next celebration after a short delay
    setTimeout(showNextCelebration, 500);
  };

  useEffect(() => {
    showNextCelebration();
  }, [celebrationQueue, currentCelebration]);

  return {
    currentCelebration,
    addCelebration,
    closeCelebration,
    hasPendingCelebrations: celebrationQueue.length > 0,
  };
};
