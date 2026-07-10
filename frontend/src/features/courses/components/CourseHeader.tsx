import React from 'react';
import { Menu, X, Search } from 'lucide-react';

interface CourseHeaderProps {
  courseTitle: string;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const CourseHeader = ({
  courseTitle,
  sidebarOpen,
  toggleSidebar,
  searchTerm,
  setSearchTerm,
}: CourseHeaderProps) => (
  <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-600 dark:text-slate-300"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{courseTitle}</h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            title="Search course content"
          />
        </div>
      </div>
    </div>
  </header>
);
