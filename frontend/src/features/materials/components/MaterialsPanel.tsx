'use client';

import React, { useState } from 'react';
import { FileText, Download, Eye } from 'lucide-react';
import { Material } from '@/shared/types/materialInterface';
import { PDFMaterialViewer } from './PDFMaterialViewer';

interface MaterialsPanelProps {
  courseId: string;
  materials: Material[];
  isLoading?: boolean;
}

export const MaterialsPanel: React.FC<MaterialsPanelProps> = ({
  courseId,
  materials,
  isLoading = false,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'viewer'>('list');

  const handleViewMaterial = (material: Material) => {
    const url = material.fileUrl || material.url;
    if (url?.endsWith('.pdf')) {
      setSelectedMaterial(material);
      setViewMode('viewer');
    } else if (url) {
      // Handle other file types or open in new tab
      window.open(url, '_blank');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedMaterial(null);
  };

  if (viewMode === 'viewer' && selectedMaterial) {
    const materialUrl = selectedMaterial.fileUrl || selectedMaterial.url || '';
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToList}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-2"
        >
          ← Back to Materials
        </button>

        <PDFMaterialViewer
          materialId={selectedMaterial.materialId || selectedMaterial.id}
          materialTitle={selectedMaterial.title}
          materialUrl={materialUrl}
          courseId={courseId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Course Materials ({materials.length})
        </h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 dark:text-slate-400">Loading materials...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-slate-400">No materials available for this course</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((material) => {
            const materialUrl = material.fileUrl || material.url;
            return (
              <div
                key={material.materialId || material.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:shadow-md transition"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {material.title}
                    </h4>
                    {material.description && (
                      <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                        {material.description}
                      </p>
                    )}
                    {material.size && (
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                        {material.size}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => handleViewMaterial(material)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                    title="View material"
                    aria-label={`View ${material.title}`}
                  >
                    <Eye size={18} />
                  </button>

                  {materialUrl && (
                    <a
                      href={materialUrl}
                      download
                      className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition"
                      title="Download material"
                      aria-label={`Download ${material.title}`}
                    >
                      <Download size={18} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
