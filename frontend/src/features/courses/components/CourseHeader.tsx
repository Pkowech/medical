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
  <header className="bg-card dark:bg-card border-b border-border dark:border-border px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-muted dark:hover:bg-secondary rounded-lg text-muted-foreground dark:text-muted-foreground"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <h1 className="text-xl font-bold text-foreground dark:text-foreground">{courseTitle}</h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground dark:text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-border dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-card dark:bg-card text-foreground dark:text-foreground"
            title="Search course content"
          />
        </div>
      </div>
    </div>
  </header>
);
