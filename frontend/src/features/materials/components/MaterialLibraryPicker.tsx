'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { materialService } from '@/features/courses/services/materialService';
import { Material } from '@/shared/types/materialInterface';
import {
  Search,
  Paperclip,
  X,
  FileText,
  Video,
  Music,
  Layout,
  BookOpen,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AttachContext {
  topicId?: string;
  unitId?: string;
  courseId?: string;
  title: string;
}

interface MaterialLibraryPickerProps {
  /**
   * Called when the admin confirms attaching a material.
   * The parent page is responsible for calling materialService.attachMaterial.
   */
  onAttach: (material: Material, context: AttachContext) => Promise<void>;
  /** Pre-fill context if opened from within a topic/unit panel */
  topicId?: string;
  unitId?: string;
  courseId?: string;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf:   <FileText className="w-4 h-4 text-red-500" />,
  video: <Video    className="w-4 h-4 text-blue-500" />,
  audio: <Music    className="w-4 h-4 text-purple-500" />,
  slide: <Layout   className="w-4 h-4 text-orange-500" />,
  notes: <BookOpen className="w-4 h-4 text-green-500" />,
};

const getTypeIcon = (type?: string) =>
  TYPE_ICONS[(type ?? '').toLowerCase()] ?? <FileText className="w-4 h-4 text-gray-400" />;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const MaterialLibraryPicker: React.FC<MaterialLibraryPickerProps> = ({
  onAttach,
  topicId,
  unitId,
  courseId,
  onClose,
}) => {
  const [search, setSearch]           = useState('');
  const [materials, setMaterials]     = useState<Material[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<Material | null>(null);
  const [attachTitle, setAttachTitle] = useState('');
  const [attaching, setAttaching]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  // ── Fetch library ──────────────────────────────────────────────────────────
  const fetchMaterials = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const result = await materialService.getMaterialsPaginated({
        page: 1,
        limit: 50,
        search: q || undefined,
        scope: 'all',
      });
      setMaterials(result.items ?? []);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchMaterials(''); }, [fetchMaterials]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchMaterials(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchMaterials]);

  // ── Selection ──────────────────────────────────────────────────────────────
  const handleSelect = (m: Material) => {
    setSelected(m);
    setAttachTitle(m.title);
    setError(null);
    setSuccess(false);
  };

  // ── Confirm attach ─────────────────────────────────────────────────────────
  const handleAttach = async () => {
    if (!selected) return;
    setAttaching(true);
    setError(null);
    try {
      await onAttach(selected, {
        topicId,
        unitId,
        courseId,
        title: attachTitle.trim() || selected.title,
      });
      setSuccess(true);
      setTimeout(onClose, 900); // brief success flash before closing
    } catch (e: any) {
      setError(e?.message ?? 'Failed to attach material. Please try again.');
    } finally {
      setAttaching(false);
    }
  };

  // ── Close on backdrop click ────────────────────────────────────────────────
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Attach from R2 Library
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Reuse an existing textbook or file — zero re-upload, zero extra storage cost.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors ml-4 flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search existing materials by title, type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* ── Material list ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Loading library…</span>
            </div>
          ) : materials.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {search ? `No materials matching "${search}"` : 'No materials in the library yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {materials.map(m => (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={`flex items-start gap-3 py-3 px-3 rounded-lg cursor-pointer transition-colors ${
                    selected?.id === m.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getTypeIcon(m.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {m.type?.toUpperCase()}
                      {m.description ? ` · ${m.description.slice(0, 70)}` : ''}
                    </p>
                  </div>
                  {selected?.id === m.id && (
                    <Paperclip className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Confirm panel ────────────────────────────────────────────────── */}
        {selected && (
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <p className="text-xs font-medium text-gray-600 mb-1">
              Display title in this course / topic:
            </p>
            <Input
              value={attachTitle}
              onChange={e => setAttachTitle(e.target.value)}
              placeholder="e.g. Guyton Cardiac Chapter — Nursing Edition"
              className="mb-3"
            />

            {error && (
              <p className="text-xs text-red-500 mb-3 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-600 text-sm mb-3">
                <CheckCircle2 className="w-4 h-4" />
                <span>Attached successfully!</span>
              </div>
            )}

            <div className="flex items-center gap-2 justify-between">
              <p className="text-xs text-gray-400">
                Original file: <span className="font-medium">{selected.title}</span> ({selected.type?.toUpperCase()})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(null)}
                  disabled={attaching}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAttach} disabled={attaching || success}>
                  {attaching ? (
                    <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Attaching…</>
                  ) : (
                    <><Paperclip className="w-3 h-3 mr-1" /> Attach to Topic</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
