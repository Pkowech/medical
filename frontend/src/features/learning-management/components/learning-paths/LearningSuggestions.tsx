import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { School, Clock, Bookmark, BookmarkPlus } from 'lucide-react';

interface LearningSuggestion {
  id: string;
  title: string;
  description: string;
  type: string;
  estimatedTime: number;
  unit: {
    id: string;
    name: string;
    code: string;
  };
  isBookmarked: boolean;
}

interface LearningSuggestionsProps {
  suggestions: LearningSuggestion[];
  onBookmark: (id: string) => void;
  onStart: (id: string) => void;
}

export const LearningSuggestions: React.FC<LearningSuggestionsProps> = ({
  suggestions,
  onBookmark,
  onStart,
}) => {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {suggestions.map(suggestion => (
          <Card key={suggestion.id}>
            <CardContent>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{suggestion.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBookmark(suggestion.id)}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {suggestion.isBookmarked ? (
                    <Bookmark className="h-4 w-4 mr-2" />
                  ) : (
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                  )}
                  {suggestion.isBookmarked ? 'Bookmarked' : 'Bookmark'}
                </Button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {suggestion.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <School className="h-3 w-3 mr-1" />
                  {suggestion.type}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Clock className="h-3 w-3 mr-1" />
                  {suggestion.estimatedTime} mins
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {suggestion.unit.name}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  {suggestion.unit.code}
                </span>
              </div>

              <Button onClick={() => onStart(suggestion.id)} className="w-full">
                Start Learning
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
