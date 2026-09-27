import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Bot, User, Share2 } from 'lucide-react';

export interface NoteItem {
  id: string;
  content?: string;
  text?: string;
  type?: 'student' | 'ai_generated' | 'peer_shared';
  isStale?: boolean;
  createdAt?: string;
  timestamp?: string;
}

interface NotesPanelProps {
  topicId?: string;
  materialId?: string;
  lessonKey?: string;
  notes?: Record<string, NoteItem[]> | NoteItem[];
  saveNote?: (lessonKey: string, noteText: string) => void;
  onSaveNoteApi?: (content: string, type?: 'student' | 'ai_generated') => Promise<void>;
}

export const NotesPanel = ({
  topicId,
  materialId,
  lessonKey = 'general',
  notes: propNotes,
  saveNote,
  onSaveNoteApi,
}: NotesPanelProps) => {
  const [noteInput, setNoteInput] = useState('');
  const [noteList, setNoteList] = useState<NoteItem[]>([]);

  useEffect(() => {
    if (Array.isArray(propNotes)) {
      setNoteList(propNotes);
    } else if (propNotes && typeof propNotes === 'object') {
      setNoteList(propNotes[lessonKey] || []);
    }
  }, [propNotes, lessonKey]);

  const handleSave = async () => {
    if (!noteInput.trim()) return;

    if (onSaveNoteApi) {
      await onSaveNoteApi(noteInput, 'student');
      setNoteInput('');
    } else if (saveNote) {
      saveNote(lessonKey, noteInput);
      setNoteInput('');
    }
  };

  const getNoteIcon = (type?: string) => {
    switch (type) {
      case 'ai_generated':
        return <Bot className="w-4 h-4 text-purple-600 inline mr-1" />;
      case 'peer_shared':
        return <Share2 className="w-4 h-4 text-green-600 inline mr-1" />;
      default:
        return <User className="w-4 h-4 text-blue-600 inline mr-1" />;
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Knowledge & Notes</h3>
        <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">
          {topicId ? 'Linked to Topic' : 'General'}
        </span>
      </div>

      <div className="mb-4">
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          placeholder="Add active recall notes, reflections, or key points..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSave}
            disabled={!noteInput.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Note"
          >
            <Save className="w-4 h-4" />
            <span>Save Note</span>
          </button>
        </div>
      </div>

      {noteList.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 text-sm">Saved Notes ({noteList.length})</h4>
          {noteList.map(note => {
            const dateStr = note.createdAt || note.timestamp;
            const textContent = note.content || note.text || '';
            return (
              <div
                key={note.id}
                className={`p-3.5 rounded-lg border ${
                  note.isStale
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {note.isStale && (
                  <div className="flex items-center space-x-1.5 text-xs text-amber-800 font-semibold mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Source material updated since this note was created. Please review.</span>
                  </div>
                )}
                <p className="text-gray-800 text-sm mb-2 whitespace-pre-wrap">{textContent}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    {getNoteIcon(note.type)}
                    <span className="capitalize">{note.type ? note.type.replace('_', ' ') : 'Student Note'}</span>
                  </span>
                  {dateStr && <span>{new Date(dateStr).toLocaleString()}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
