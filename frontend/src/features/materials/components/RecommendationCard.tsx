'use client';

import React from 'react';
import { AISuggestion } from '@/shared/types';
import { Button } from '@/shared/components/ui/button';
import { Sparkles, ArrowRight, Clock, Target, BrainCircuit } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RecommendationCardProps {
  suggestion: AISuggestion;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ suggestion }) => {
  const router = useRouter();

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase?.() || 'medium') {
      case 'high':
        return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
      case 'medium':
        return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30';
      default:
        return 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/30';
    }
  };

  return (
    <div className="group relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getPriorityColor(suggestion.priority || 'medium')}`}>
              <Sparkles className="w-3 h-3" />
              {suggestion.priority} Priority
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {suggestion.type}
            </span>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {suggestion.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {suggestion.description}
        </p>

        {/* Rationale Section - The "Why" */}
        <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-start gap-2">
            <BrainCircuit className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-0.5 uppercase tracking-wide">Why this?</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">"{suggestion.rationale}"</p>
            </div>
          </div>
        </div>

        {/* Meta & Action */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-xs font-medium">
             <div className="flex items-center gap-1.5">
               <Clock className="w-3.5 h-3.5" />
               {suggestion.estimatedTime}
             </div>
             {suggestion.relatedTopics && (
               <div className="flex items-center gap-1.5 hidden sm:flex">
                 <Target className="w-3.5 h-3.5" />
                 {suggestion.relatedTopics.length} Related
               </div>
             )}
          </div>

          <Button 
            size="sm" 
            onClick={() => router.push(suggestion.link || '#')}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 hover:text-white dark:hover:text-indigo-600 transition-all font-bold shadow-lg shadow-slate-200/50 dark:shadow-none group-hover:translate-x-1"
          >
            Start
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
