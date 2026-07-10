import React, { useState } from 'react';
import { Save } from 'lucide-react';

interface Note {
  id: string;
  text: string;
  timestamp: string;
}

interface NotesPanelProps {
  lessonKey: string;
  notes: Record<string, Note[]>;
  saveNote: (lessonKey: string, noteText: string) => void;
}

export const NotesPanel = ({ lessonKey, notes, saveNote }: NotesPanelProps) => {
  const [noteInput, setNoteInput] = useState('');
  const lessonNotes = notes[lessonKey] || [];

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
      <div className="mb-4">
        <textarea
          value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          placeholder="Add your notes here..."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => {
              saveNote(lessonKey, noteInput);
              setNoteInput('');
            }}
            disabled={!noteInput.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save Note"
          >
            <Save className="w-4 h-4" />
            <span>Save Note</span>
          </button>
        </div>
      </div>

      {lessonNotes.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Previous Notes</h4>
          {lessonNotes.map(note => (
            <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-gray-700 mb-2">{note.text}</p>
              <p className="text-xs text-gray-500">{new Date(note.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
