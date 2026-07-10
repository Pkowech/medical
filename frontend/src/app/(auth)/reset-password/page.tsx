'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
// AuthLayout is now handled by the (auth) route group layout
import { AuthForm } from '@/features/auth/components/AuthForm';
import { FormField } from '@/features/auth/components/FormField';
import { Notification } from '@/features/auth/components/Notification';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const token = searchParams.get('token');

  if (!token) {
    return (
      <div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invalid Reset Link</h2>
          <p className="text-gray-600 dark:text-gray-400">
            This password reset link is invalid or has expired. Please request a new password reset
            link.
          </p>
          <div className="pt-4">
            <Link
              href="/auth/forgot-password"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // useAuthStore.resetPassword expects (token, newPassword)
      await resetPassword(token, formData.password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred while resetting your password'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (success) {
    return (
      <div>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Password Reset Successful
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your password has been reset successfully. You will be redirected to the login page
            shortly.
          </p>
          <div className="pt-4">
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <AuthForm
        title="Create New Password"
        subtitle="Please enter your new password"
        onSubmit={handleSubmit}
        isLoading={isLoading}
        submitText="Reset Password"
      >
        <div className="space-y-4">
          <FormField
            label="New Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Enter new password"
            helperText="Must be at least 8 characters long"
          />

          <FormField
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Confirm new password"
          />
        </div>
      </AuthForm>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
