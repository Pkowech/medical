import { FormField } from './FormField';
import React, { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { RateLimitInfo } from '@/shared/components/layout/RateLimitInfo';
import { useRateLimit } from '@/shared/hooks/useRateLimit';

export const LoginForm: React.FC = () => {
  const { signIn } = useAuth();
  const { checkLimit } = useRateLimit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isAllowed = await checkLimit('auth/login');
      if (!isAllowed) {
        setError('Too many login attempts. Please try again later.');
        setLoading(false);
        return;
      }

      const result = await signIn('credentials', {
        redirect: false,
        identifier: email,
        password,
      });

      if (result?.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Email"
        type="email"
        id="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        error={error ?? undefined}
      />

      <FormField
        label="Password"
        type="password"
        id="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <RateLimitInfo endpoint="auth/login" className="mt-2" />

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
