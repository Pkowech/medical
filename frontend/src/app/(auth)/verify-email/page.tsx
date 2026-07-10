'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaEnvelope, FaSpinner, FaCheck, FaTimes } from 'react-icons/fa';
import { authService } from '@/features/auth/services/authService';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams?.get('token');
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const data = await authService.verifyEmail(token);
        
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (error: unknown) {
        setStatus('error');
        const errMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Failed to verify email';
        setMessage(errMessage);
      }
    };

    verifyEmail();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Email Verification
          </h2>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-gray-100 p-3">
                {status === 'verifying' && (
                  <FaSpinner className="h-6 w-6 text-blue-500 animate-spin" />
                )}
                {status === 'success' && <FaCheck className="h-6 w-6 text-green-500" />}
                {status === 'error' && <FaTimes className="h-6 w-6 text-red-500" />}
              </div>
              <div className="text-center">
                <p
                  className={`text-lg ${
                    status === 'verifying'
                      ? 'text-blue-600'
                      : status === 'success'
                        ? 'text-green-600'
                        : 'text-red-600'
                  }`}
                >
                  {message}
                </p>
              </div>
              {status === 'error' && (
                <div className="text-center space-y-3">
                  <p className="text-sm text-gray-500">
                    If you're having trouble verifying your email, you can:
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const data = await authService.resendVerificationEmail();
                        setMessage(data.message || 'New verification email sent! Please check your inbox.');
                      } catch (error: unknown) {
                        const errMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Failed to resend verification email';
                        setMessage(errMessage);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-500"
                  >
                    Request a new verification link
                  </button>
                  <div className="pt-2">
                    <Link href="/login" className="text-blue-600 hover:text-blue-500">
                      Return to login
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 text-center">
            <FaEnvelope className="mx-auto h-10 w-10 text-blue-500 animate-pulse" />
            <p className="text-lg text-blue-600">Preparing verification details...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
