'use client';

import Link from 'next/link';
import { getInstructorDisplayName } from '@/lib/utils';

interface SearchResultItemProps {
  course: {
    id: string;
    title?: string;
    name?: string;
    type?: string;
    instructor?: {
      name: string;
    };
  };
  onSelect?: () => void;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({ course, onSelect }) => {
  let href = `/courses/${course.id}`;
  if (course.type === 'unit') href = `/units/${course.id}`;
  else if (course.type === 'topic') href = `/topics/${course.id}`;
  else if (course.type === 'material') href = `/materials/${course.id}`;
  else if (course.type === 'user') href = `/profile/${course.id}`;
  else if (course.type === 'quiz') href = `/quiz/${course.id}`;
  else if (course.type === 'case') href = `/clinical-cases/${course.id}`;

  return (
    <li className="border-b last:border-b-0">
      <Link
        href={href}
        onClick={onSelect}
        className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {course.title || course.name}
        </div>
        {course.instructor && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getInstructorDisplayName({
              id: course.id,
              name: course.instructor.name,
            })}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">Type: {course.type || 'course'}</div>
      </Link>
    </li>
  );
};
