'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { FormField } from '@/features/auth/components/FormField';
import { AuthFormData } from '@/shared/types/authInterface';
import { Role } from '@/shared/enums/role.enum';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { registerSchema } from '@/lib/auth/validations';
import { AuthErrorCode, getAuthErrorDetails } from '@/features/auth/services/authErrors';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { register, isLoading } = useAuthStore();
  const { isAuthenticated, signIn: nextAuthSignIn } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const [formData, setFormData] = useState<AuthFormData>({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    acceptTerms: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = registerSchema.safeParse(formData);
    if (!validationResult.success) {
      setFieldErrors(
        Object.fromEntries(
          validationResult.error.issues.map(issue => [
            String(issue.path[0]),
            issue.message,
          ])
        )
      );
      return;
    }

    try {
      setFieldErrors({});
      await register({
        email: validationResult.data.email,
        password: validationResult.data.password,
        firstName: validationResult.data.firstName,
        lastName: validationResult.data.lastName,
        username: validationResult.data.username,
        role: Role.student,
        confirmPassword: validationResult.data.confirmPassword,
        acceptTerms: validationResult.data.acceptTerms,
      });
      toast({
        title: 'Account created',
        description: 'Sign in to finish setting up your profile and learning goals.',
      });
      router.push('/login?callbackUrl=%2Ffinish-setup');
    } catch (err: unknown) {
      useAuthStore.getState().clearError();
      const authError = getAuthErrorDetails(
        err,
        'An unexpected error occurred during registration.'
      );
      setFieldErrors(authError.fieldErrors);

      if (
        authError.code === AuthErrorCode.USERNAME_TAKEN ||
        authError.fieldErrors.username
      ) {
        setFieldErrors(prev => ({
          ...prev,
          username: 'That username is already in use. Please choose another.',
        }));
        return;
      }

      if (authError.code === AuthErrorCode.EMAIL_TAKEN || authError.fieldErrors.email) {
        setFieldErrors(prev => ({
          ...prev,
          email: 'An account with this email already exists.',
        }));
        toast({
          title: 'Email already registered',
          description: (
            <p>
              Sign in to the existing account or use another email address.{' '}
              <Link href="/login" className="font-medium underline">
                Sign in
              </Link>
            </p>
          ),
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      if (Object.keys(authError.fieldErrors).length) return;
      toast({
        title: 'Registration failed',
        description: authError.message,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleProviderSignIn = async (provider: 'google' | 'github') => {
    try {
      await nextAuthSignIn(provider, { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error(`[Register] ${provider} sign-in failed:`, error);
      toast({
        title: 'Unable to continue',
        description: `Could not continue with ${provider === 'google' ? 'Google' : 'GitHub'} right now. Please try again.`,
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  return (
    <AuthForm
      title="Sign Up"
      subtitle="Create your account to get started"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitText="Create Account"
      noValidate
      footer={
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">
              <span className="bg-white px-2 dark:bg-slate-900">Or continue with</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleProviderSignIn('google')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <span aria-hidden="true">G</span>
              Google
            </button>

            <button
              type="button"
              onClick={() => void handleProviderSignIn('github')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <span aria-hidden="true">GH</span>
              GitHub
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="First Name" // Changed label
          type="text"
          name="firstName" // Changed name
          autoComplete="given-name"
          value={formData.firstName} // Changed value
          onChange={handleChange}
          error={fieldErrors.firstName}
          required
          placeholder="Enter your first name" // Changed placeholder
        />
        <FormField
          label="Last Name" // Added
          type="text"
          name="lastName" // Added
          autoComplete="family-name"
          value={formData.lastName} // Added
          onChange={handleChange}
          error={fieldErrors.lastName}
          required
          placeholder="Enter your last name" // Added
        />

        <FormField
          label="Email Address"
          type="email"
          name="email"
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          error={fieldErrors.email}
          required
          placeholder="Enter your email"
        />

        <FormField
          label="Username"
          type="text"
          name="username"
          autoComplete="username"
          value={formData.username}
          onChange={handleChange}
          error={fieldErrors.username}
          required
          placeholder="Create a username"
        />

        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
          required
          placeholder="Create a password"
          helperText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
        />

        <FormField
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
          required
          placeholder="Confirm your password"
        />

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id="acceptTerms"
              name="acceptTerms"
              checked={formData.acceptTerms}
              onChange={handleChange}
              aria-invalid={!!fieldErrors.acceptTerms}
              aria-describedby={fieldErrors.acceptTerms ? 'acceptTerms-error' : undefined}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
          {fieldErrors.acceptTerms && (
            <p id="acceptTerms-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
              {fieldErrors.acceptTerms}
            </p>
          )}
          <div className="ml-3 text-sm">
            <label htmlFor="acceptTerms" className="text-gray-600 dark:text-slate-300">
              I agree to the{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-300">
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>
      </div>
    </AuthForm>
  );
}
