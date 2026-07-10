'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { RapidReviewSession } from '@/features/assessment/components/rapid-review/RapidReviewSession';

export default function RapidReviewPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-xl bg-white rounded-xl shadow p-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 text-blue-700">Rapid Review Mode</h1>
        <p className="text-gray-600 mb-6 text-center">
          High-yield, fast-paced review of your weakest topics. Answer quickly, get instant
          feedback, and reinforce what matters most.
        </p>
        {/* --- Rapid Review Session UI --- */}
        {user?.id ? (
          <RapidReviewSession userId={user.id} />
        ) : (
          <div className="text-gray-400 my-8">Please log in to start rapid review.</div>
        )}
        <Button onClick={() => router.push('/dashboard')} variant="outline" className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
