'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiService from '@/features/auth/services/apiClient';
import { Button } from '@/shared/components/ui/button';

type ImportedQuiz = {
  id: string;
  title: string;
  isPublished: boolean;
};

type QuizImportPayload = {
  title: string;
  description?: string;
  courseId?: string;
  unitId?: string;
  topicId?: string;
  passingScore?: number;
  questions: Array<{
    questionText: string;
    type: 'multiple_choice' | 'multiple_select' | 'true_false';
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
    explanation?: string;
    tags?: string[];
    conceptsCovered?: string[];
    topicIds?: string[];
    options: Array<{ text: string; isCorrect: boolean }>;
  }>;
};

interface BulkQuestionImportProps {
  onImported: () => void;
}

export function BulkQuestionImport({ onImported }: BulkQuestionImportProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<QuizImportPayload | null>(null);
  const [publishOnImport, setPublishOnImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedQuiz, setImportedQuiz] = useState<ImportedQuiz | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const readFile = async (file?: File) => {
    setError(null);
    setImportedQuiz(null);
    setPayload(null);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('The JSON file must be no larger than 2 MB.');
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('title' in parsed) ||
        typeof parsed.title !== 'string' ||
        !('questions' in parsed) ||
        !Array.isArray(parsed.questions) ||
        parsed.questions.length < 1 ||
        parsed.questions.length > 100
      ) {
        throw new Error('Expected a quiz object with a title and 1–100 questions.');
      }
      setPayload(parsed as QuizImportPayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this JSON file.');
    }
  };

  const importQuiz = async () => {
    if (!payload || isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const response = await apiService.post<ImportedQuiz>('/quizzes/import', {
        ...payload,
        isPublished: publishOnImport,
      });
      setImportedQuiz(response.data);
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Quiz import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const publishDraft = async () => {
    if (!importedQuiz || importedQuiz.isPublished || isPublishing) return;
    setIsPublishing(true);
    setError(null);
    try {
      await apiService.post(`/quizzes/${importedQuiz.id}/publish`);
      setImportedQuiz({ ...importedQuiz, isPublished: true });
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Quiz publishing failed.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Import a quiz and add its questions to the bank</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload UTF-8 JSON. The quiz and all its questions/options are saved together; invalid imports are rejected.
        </p>
      </div>
      <label className="block text-sm font-medium">
        Quiz JSON file
        <input
          className="mt-2 block w-full rounded-md border border-input bg-background p-2 text-sm"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
      </label>
      {payload && (
        <div className="rounded-md bg-muted p-3 text-sm">
          Ready: <strong>{payload.title}</strong> ({payload.questions.length} questions)
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publishOnImport}
          onChange={(event) => setPublishOnImport(event.target.checked)}
        />
        Publish immediately for learners
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" onClick={() => void importQuiz()} disabled={!payload || isImporting}>
        {isImporting ? 'Importing…' : 'Import quiz'}
      </Button>
      {importedQuiz && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          <p>
            Saved “{importedQuiz.title}” ({importedQuiz.isPublished ? 'published' : 'draft'}).
          </p>
          {!importedQuiz.isPublished && (
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0"
              disabled={isPublishing}
              onClick={() => void publishDraft()}
            >
              {isPublishing ? 'Publishing…' : 'Publish for learners'}
            </Button>
          )}
          {importedQuiz.isPublished && (
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0"
              onClick={() => router.push(`/assessment/${importedQuiz.id}`)}
            >
              Open quiz
            </Button>
          )}
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Expected JSON format</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
          <code>{`{
  "title": "Renal pharmacology",
  "description": "Practice quiz",
  "unitId": "OPTIONAL-UNIT-UUID",
  "topicId": "OPTIONAL-TOPIC-UUID",
  "passingScore": 70,
  "questions": [{
    "questionText": "Which concept ...?",
    "type": "multiple_choice",
    "difficulty": "medium",
    "category": "general",
    "explanation": "Why the answer is correct.",
    "conceptsCovered": ["drug clearance"],
    "topicIds": ["OPTIONAL-TOPIC-UUID"],
    "options": [
      { "text": "Correct answer", "isCorrect": true },
      { "text": "Distractor", "isCorrect": false }
    ]
  }]
}`}</code>
        </pre>
        <p className="mt-2 text-muted-foreground">
          Question type, difficulty, and category must match the supported values. Link each question to its actual topic; prerequisite diagnosis depends on those mappings and the course/unit prerequisite graph being maintained.
        </p>
      </details>
    </section>
  );
}