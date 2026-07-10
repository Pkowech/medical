'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { FormField } from '@/features/auth/components/FormField';
import { Notification } from '@/features/auth/components/Notification';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while processing your request'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Check Your Email</h2>
        <p className="text-gray-600 dark:text-gray-400">
          We've sent password reset instructions to {email}
        </p>
        <div className="pt-4">
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <AuthForm
        title="Forgot Password"
        subtitle="Enter your email address and we'll send you instructions to reset your password"
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitText="Send Reset Instructions"
        footer={
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        }
      >
        <FormField
          label="Email Address"
          type="email"
          name="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
        />
      </AuthForm>
    </>
  );
}
