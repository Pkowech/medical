'use client';

import React from 'react';
import { Filter, Search } from 'lucide-react';

interface MaterialsFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export const MaterialsFilter: React.FC<MaterialsFilterProps> = ({
  searchTerm,
  onSearchChange,
  filter,
  onFilterChange,
}) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search materials..."
          className="pl-10 pr-4 py-2 w-full border border-border dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card dark:bg-card text-foreground dark:text-foreground"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="relative w-48">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Filter className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
        </div>
        <select
          aria-label="Filter materials by type"
          className="pl-10 pr-4 py-2 w-full border border-border dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card dark:bg-card text-foreground dark:text-foreground"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="pdf">PDF</option>
          <option value="doc">Document</option>
          <option value="image">Image</option>
        </select>
      </div>
    </div>
  );
};
