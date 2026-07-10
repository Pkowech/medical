import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { RateLimitInfo } from '@/shared/components/layout/RateLimitInfo';
import { useRateLimit } from '@/shared/hooks/useRateLimit';

export const ForgotPasswordForm: React.FC = () => {
  const { forgotPassword } = useAuthStore();
  const { checkLimit } = useRateLimit();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const isAllowed = await checkLimit('auth/forgot-password');
      if (!isAllowed) {
        setError('Too many password reset attempts. Please try again later.');
        return;
      }

      await forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send password reset email';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900">Check your email</h3>
        <p className="mt-2 text-sm text-gray-500">
          We have sent a password reset link to your email address.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <RateLimitInfo endpoint="auth/forgot-password" className="mt-2" />

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>
    </form>
  );
};
