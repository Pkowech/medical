import React from 'react';
import { AlertTriangle, TrendingDown, BookOpen, ArrowRight } from 'lucide-react';
import { useHighRiskTopics } from '../hooks/useHighRiskTopics';
import Link from 'next/link';

interface HighRiskTopicsCardProps {
  userId: string;
}

export const HighRiskTopicsCard: React.FC<HighRiskTopicsCardProps> = ({ userId }) => {
  const { data: topics, isLoading, isError } = useHighRiskTopics(userId);

  if (isLoading) {
    return (
      <div className="bg-card/80 dark:bg-card/50 backdrop-blur-md rounded-2xl p-6 border border-border dark:border-border/50 animate-pulse">
        <div className="h-6 w-48 bg-secondary dark:bg-secondary rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted dark:bg-card/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !topics || topics.length === 0) {
    return null;
  }

  return (
    <div className="bg-card/90 dark:bg-card/60 backdrop-blur-md rounded-2xl shadow-sm border border-red-100 dark:border-red-900/20 overflow-hidden group">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground dark:text-foreground font-outfit">Critical Focus Areas</h3>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground">Topics with lowest performance</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-red-100 dark:border-red-800/30">
            Action Required
          </span>
        </div>

        <div className="space-y-3">
          {topics.map((topic, index) => (
            <Link
              key={index}
              href="/flashcards"
              aria-label={`Review flashcards for ${topic.topic}`}
              className="group/item flex items-center justify-between p-4 bg-background/50 dark:bg-card/40 rounded-xl border border-border dark:border-border/30 hover:border-red-200 dark:hover:border-red-800/50 hover:bg-card dark:hover:bg-card transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <BookOpen className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground dark:text-foreground group-hover/item:text-red-600 dark:group-hover/item:text-red-400 transition-colors">
                    {topic.topic}
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-medium text-muted-foreground dark:text-muted-foreground">
                      {topic.cardCount} Cards
                    </span>
                    <span className="w-1 h-1 bg-secondary dark:bg-secondary rounded-full" />
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <TrendingDown className="w-2.5 h-2.5" />
                      {(topic.passRate * 100).toFixed(0)}% Mastery
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted dark:bg-card group-hover/item:bg-red-50 dark:group-hover/item:bg-red-900/30 transition-colors">
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/item:text-red-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
        
        <Link
          href="/flashcards"
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Review All Struggling Topics
        </Link>
      </div>
    </div>
  );
};
