'use client';

import { useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Something went wrong!</h1>
          <p className="mt-2 text-gray-600">{error.message || 'An unexpected error occurred'}</p>
        </div>
        <div className="mt-6 flex justify-center space-x-4">
          <Button onClick={() => reset()} className="bg-blue-600 hover:bg-blue-700">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = '/')} variant="outline">
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}
