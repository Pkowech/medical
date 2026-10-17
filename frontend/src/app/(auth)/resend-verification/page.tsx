'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaSpinner } from 'react-icons/fa';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { FormField } from '@/features/auth/components/FormField';
import { Notification } from '@/features/auth/components/Notification';
import { authService } from '@/features/auth/services/authService';
import { getAuthErrorDetails } from '@/features/auth/services/authErrors';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await authService.resendVerificationEmail(email.trim());
      setMessage(
        response.message ??
          'If an unverified account exists for this email, a verification link will be sent.',
      );
    } catch (requestError: unknown) {
      setError(
        getAuthErrorDetails(
          requestError,
          'Could not request a verification email. Please try again later.',
        ).message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && <Notification type="error" message={error} onClose={() => setError('')} />}
      <AuthForm
        title="Resend Verification Email"
        subtitle="Enter the email address you used to register. If it belongs to an unverified account, we’ll send a new link."
        onSubmit={handleSubmit}
        isLoading={loading}
        submitText={loading ? 'Sending...' : 'Send Verification Link'}
        footer={
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Return to sign in
            </Link>
          </p>
        }
      >
        {message ? (
          <p role="status" className="rounded-md bg-green-50 p-4 text-sm text-green-800">
            {message}
          </p>
        ) : (
          <FormField
            label="Email Address"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            placeholder="Enter your email"
          />
        )}
      </AuthForm>
      {loading && (
        <span className="sr-only" role="status">
          <FaSpinner aria-hidden="true" />
          Sending verification request
        </span>
      )}
    </>
  );
}
