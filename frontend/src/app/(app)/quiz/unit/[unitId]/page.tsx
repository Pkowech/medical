'use client';
import React, { useEffect, useState } from 'react';
import { DynamicPageProps } from '@/shared/types/nextPageProps';
import type { Quiz } from '@/shared/types';

interface QuizResult {
  score: number;
  passed: boolean;
  feedback?: string;
}

type UnitQuizPageProps = DynamicPageProps<{ unitId: string }>;

export default function UnitQuizPage({ params }: UnitQuizPageProps) {
  const [unitId, setUnitId] = useState<string>('');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [eligible, setEligible] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    params.then(resolvedParams => {
      setUnitId(resolvedParams.unitId);
    });
  }, [params]);

  useEffect(() => {
    if (!unitId) return;

    const loadQuizData = async () => {
      try {
        const eligibilityRes = await fetch(`/api/quiz/unit/${unitId}/eligibility`);
        if (!eligibilityRes.ok) throw new Error('Failed to load eligibility');
        const eligibilityData = await eligibilityRes.json();
        setEligible(eligibilityData.eligible);

        const quizRes = await fetch(`/api/quiz/unit/${unitId}`);
        if (!quizRes.ok) throw new Error('Failed to load quiz');
        const quizData = await quizRes.json();
        setQuiz(quizData);
      } catch (error) {
        console.warn('Failed to load quiz data:', error instanceof Error ? error.message : error);
      }
    };
    loadQuizData();
  }, [unitId]);

  if (!eligible) return <div>Complete all topics to unlock this quiz.</div>;
  if (!quiz) return <div>Loading...</div>;

  const handleChange = (qid: string, value: string) => {
    setAnswers(a => ({ ...a, [qid]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/quiz/unit/${unitId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Failed to submit quiz');
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.warn('Quiz submission error:', error instanceof Error ? error.message : error);
    }
  };

  if (result) {
    return (
      <div>
        <h2>Your Score: {result.score}%</h2>
        <p>{result.passed ? 'Passed!' : 'Try again for mastery.'}</p>
        {result.feedback && <div>{result.feedback}</div>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{quiz?.title || 'Quiz'}</h1>
      {quiz?.description && <p>{quiz.description}</p>}
      {quiz?.questions && quiz.questions.map(q => (
        <div key={q.id}>
          <p>{q.question_text}</p>
          {q.options?.map((opt, idx) => {
            const isObject = typeof opt !== 'string';
            const val = isObject ? opt.id : opt;
            const labelText = isObject ? opt.option_text : opt;
            return (
              <label key={isObject ? opt.id : `opt-${idx}`}>
                <input
                  type="radio"
                  name={q.id}
                  value={val}
                  checked={answers[q.id] === val}
                  onChange={() => handleChange(q.id, val)}
                  required
                />
                {labelText}
              </label>
            );
          })}
        </div>
      ))}
      <button type="submit" className="btn-primary">
        Submit Quiz
      </button>
    </form>
  );
}
