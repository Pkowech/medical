'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { SpacedRepetitionReview } from '@/features/learning-management/study/components/SpacedRepetitionReview';
import { Button } from '@/shared/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function FlashcardStudyPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  // id could be 'all' or a specific categoryId/unitId in the future
  const _id = params.id as string;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center">
        <Button variant="ghost" onClick={() => router.push('/flashcards')} className="mr-4">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Decks
        </Button>
        <h1 className="text-2xl font-bold">Review Session</h1>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 p-6">
        {user?.id ? (
          <SpacedRepetitionReview 
            questionId="" // The index/current card is handled inside the component
            question="" 
            answer=""
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Please log in to review flashcards.</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Pro Tip: Press "1" for Hard, "2" for Good, and "3" for Easy.</p>
      </div>
    </div>
  );
}
