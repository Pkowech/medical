import React from 'react';
import { AlertTriangle, TrendingDown, BookOpen, ArrowRight } from 'lucide-react';
import { useHighRiskTopics } from '../hooks/useHighRiskTopics';
import { useRouter } from 'next/navigation';

interface HighRiskTopicsCardProps {
  userId: string;
}

export const HighRiskTopicsCard: React.FC<HighRiskTopicsCardProps> = ({ userId }) => {
  const { data: topics, isLoading, isError } = useHighRiskTopics(userId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-100 dark:border-slate-700/50 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/90 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl shadow-sm border border-red-100 dark:border-red-900/20 overflow-hidden group">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white font-outfit">Critical Focus Areas</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Topics with lowest performance</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-red-100 dark:border-red-800/30">
            Action Required
          </span>
        </div>

        <div className="space-y-3">
          {topics.map((topic, index) => (
            <div 
              key={index}
              className="group/item flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700/30 hover:border-red-200 dark:hover:border-red-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              onClick={() => router.push('/flashcards')}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <BookOpen className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover/item:text-red-600 dark:group-hover/item:text-red-400 transition-colors">
                    {topic.topic}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-medium text-gray-500 dark:text-slate-500">
                      {topic.cardCount} Cards
                    </span>
                    <span className="w-1 h-1 bg-gray-300 dark:bg-slate-700 rounded-full" />
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <TrendingDown className="w-2.5 h-2.5" />
                      {(topic.passRate * 100).toFixed(0)}% Mastery
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 group-hover/item:bg-red-50 dark:group-hover/item:bg-red-900/30 transition-colors">
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover/item:text-red-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
        
        <button 
          onClick={() => router.push('/flashcards')}
          className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
        >
          Review All Struggling Topics
        </button>
      </div>
    </div>
  );
};
