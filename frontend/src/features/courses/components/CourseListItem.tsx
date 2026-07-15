import React from 'react';
import { Course } from '@/shared/types/courseInterface';
import { BookOpen, Users, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { getInstructorDisplayName } from '@/lib/utils';
import { Badge } from '@/shared/components/ui/badge';

interface CourseListItemProps {
  course: Course;
  onEnroll: (courseId: string) => void;
  onView: (courseId: string) => void;
}

export const CourseListItem: React.FC<CourseListItemProps> = React.memo(({ course, onEnroll, onView }) => {

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'advanced':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'expert':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div
      onClick={() => onView(course.id)}
      className="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md mb-3"
    >
      {/* Icon & Title */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br ${course.isEnrolled ? 'from-green-500 to-emerald-600' : 'from-blue-500 to-indigo-600'} text-white shadow-lg shadow-blue-500/10`}>
          {course.isEnrolled ? <CheckCircle className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {course.title}
            </h4>
            {/* Active Slot removed as it is not part of Course interface */}
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-slate-400">
             <span className="font-medium text-gray-700 dark:text-slate-300">{course.code || 'MED-CORE'}</span>
             <span className="hidden sm:inline">•</span>
             <span className="hidden sm:inline">by {getInstructorDisplayName(course.instructor)}</span>
          </div>

          {/* Mobile Info */}
          <div className="flex items-center gap-2 mt-2 sm:hidden">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${getDifficultyColor(course.difficulty)}`}>
               {course.difficulty}
            </Badge>
            {course.rating && (
                <div className="flex items-center gap-0.5 text-xs font-medium text-amber-500">
                   <Star className="w-3 h-3 fill-current" />
                   {course.rating.toFixed(1)}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Columns */}
      <div className="hidden sm:flex items-center gap-8 text-sm text-gray-500 dark:text-slate-400 flex-shrink-0 mx-6">
        {/* Category/Difficulty */}
        <div className="w-32 flex flex-col items-start gap-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getDifficultyColor(course.difficulty)}`}>
              {course.difficulty}
            </span>
            {course.category && (
               <span className="text-xs truncate max-w-full" title={course.category.name}>
                  {course.category.name}
               </span>
            )}
        </div>

        {/* Stats */}
        <div className="w-24 text-right">
           <div className="flex items-center justify-end gap-1.5 text-gray-700 dark:text-slate-300">
             <Users className="w-3.5 h-3.5" />
             <span className="font-semibold">{course.enrollmentCount || 0}</span>
           </div>
           {course.rating && (
             <div className="flex items-center justify-end gap-1 text-amber-500 mt-0.5">
               <Star className="w-3 h-3 fill-current" />
               <span className="text-xs font-bold">{course.rating.toFixed(1)}</span>
             </div>
           )}
        </div>
        
        {/* Estimated Time */}
        <div className="w-20 text-right font-medium">
           {course.estimatedHours}h
        </div>
      </div>

      {/* Actions */}
      <div className="ml-4 flex items-center gap-2 opacity-100 transition-opacity">
        {!course.isEnrolled ? (
             <Button 
               size="sm" 
               onClick={(e) => {
                 e.stopPropagation();
                 onEnroll(course.id);
               }}
               className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
             >
               Enroll
             </Button>
        ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                 e.stopPropagation();
                 onView(course.id);
               }}
            >
              Resume
            </Button>
        )}
      </div>
    </div>
  );
});
