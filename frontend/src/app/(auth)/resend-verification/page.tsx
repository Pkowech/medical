'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner, FaEnvelope } from 'react-icons/fa';
import { authService } from '@/features/auth/services/authService';

export default function ResendVerificationPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleResendVerification = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await authService.resendVerificationEmail();
      setMessage(data.message || 'Verification email sent! Please check your inbox.');
      // Optionally redirect after a delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: unknown) {
      const errMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'An error occurred. Please try again later.';
      setError(errMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Resend Verification Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Didn&apos;t receive the verification email? We&apos;ll send it again.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaEnvelope className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{message}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleResendVerification}
            disabled={loading}
            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
              loading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin -ml-1 mr-2 h-5 w-5" />
                Sending...
              </>
            ) : (
              'Resend Verification Email'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
