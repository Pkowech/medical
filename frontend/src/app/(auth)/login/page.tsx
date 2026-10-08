'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FaUser,
  FaLock,
  FaSpinner,
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaCheckCircle,
  FaExclamationCircle,
  FaGoogle,
} from 'react-icons/fa';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthErrorCode, getAuthErrorDetails } from '@/features/auth/services/authErrors';

interface FormErrors {
  identifier?: string;
  password?: string;
}

function getSafeCallbackUrl(requestedCallbackUrl: string | null): string {
  if (!requestedCallbackUrl) return '/dashboard';

  try {
    const resolvedUrl = new URL(requestedCallbackUrl, window.location.origin);
    if (resolvedUrl.origin === window.location.origin) {
      return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
    }
  } catch {
    console.warn('[Login] Ignoring invalid callback URL');
  }

  return '/dashboard';
}

function LoginContent() {
  const { login, isAuthenticated, signIn: nextAuthSignIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallbackUrl = searchParams.get('callbackUrl');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(getSafeCallbackUrl(requestedCallbackUrl));
    }
  }, [isAuthenticated, requestedCallbackUrl, router]);

  const [error, setError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSlowRequestHint, setShowSlowRequestHint] = useState(false);
  const [success, setSuccess] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formTouched, setFormTouched] = useState({
    identifier: false,
    password: false,
  });
  const [_loginAttempts, setLoginAttempts] = useState(0);
  const [message, setMessage] = useState('');

  // Determine if identifier is an email
  const isEmail = identifier.includes('@');

  const handleProviderSignIn = async () => {
    setError('');
    setSuccess('');
    setSocialLoading('google');

    try {
      await nextAuthSignIn('google', {
        callbackUrl: `/google-consent?returnTo=${encodeURIComponent(
          getSafeCallbackUrl(requestedCallbackUrl),
        )}`,
      });
    } catch (err) {
      console.error('[Login] Google sign-in failed:', err);
      setError('Could not continue with Google. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  // Validate form fields
  const validateField = (name: string, value: string) => {
    let error = '';

    switch (name) {
      case 'identifier':
        if (!value) {
          error = 'Username or email is required';
        } else if (value.length < 3) {
          error = 'Username or email must be at least 3 characters';
        }
        break;

      case 'password':
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters';
        }
        break;
    }

    return error;
  };

  useEffect(() => {
    if (searchParams.get('error') === 'google-signin-failed') {
      setError(
        'Google sign-in could not be completed. Please try again.'
      );
    }

    // Check if user was redirected from registration
    const registered = searchParams.get('registered');
    if (registered === 'true') {
      setSuccess('Registration successful! You can now log in with your credentials.');
    }

    // Check for verification success message
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setMessage('Email verified successfully! You can now log in.');
    }
  }, [searchParams]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setError('');
    setCanRetry(false);
    setShowResendVerification(false);

    if (name === 'identifier') {
      setIdentifier(value);
    } else if (name === 'password') {
      setPassword(value);
    } else if (name === 'rememberMe') {
      setRememberMe(e.target.checked);
    }

    // Mark field as touched
    if (!formTouched[name as keyof typeof formTouched]) {
      setFormTouched({
        ...formTouched,
        [name]: true,
      });
    }

    // Validate the field if it's been touched
    if (formTouched[name as keyof typeof formTouched]) {
      const error = validateField(name, value);
      setFormErrors({
        ...formErrors,
        [name]: error,
      });
    }
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError('');
    setCanRetry(false);
    setShowResendVerification(false);
    setSuccess('');

    // Mark all fields as touched for validation
    setFormTouched({
      identifier: true,
      password: true,
    });

    // Validate all fields
    const errors: FormErrors = {
      identifier: validateField('identifier', identifier),
      password: validateField('password', password),
    };

    // Update form errors
    setFormErrors(errors);

    // If there are any errors, don't submit
    if (errors.identifier || errors.password) {
      return;
    }

    setLoading(true);
    setShowSlowRequestHint(false);
    const slowRequestTimer = window.setTimeout(() => setShowSlowRequestHint(true), 8000);

    // Increment login attempts
    setLoginAttempts(prev => prev + 1);

    try {
      const result = await login(identifier, password);

      if (result?.error) {
        const authError = getAuthErrorDetails(result.error, 'Could not sign in. Please try again.');
        setError(authError.message);
        setCanRetry(
          [
            AuthErrorCode.SERVICE_UNAVAILABLE,
            AuthErrorCode.NETWORK_ERROR,
            AuthErrorCode.REQUEST_TIMEOUT,
          ].includes(authError.code)
        );
        setShowResendVerification(authError.code === 'EMAIL_NOT_VERIFIED');
      } else if (result?.ok) {
        setSuccess('Login successful! Redirecting...');

        // Keep same-origin callback URLs as client-side paths. Passing the
        // complete deployment URL can make Next.js perform a full reload.
        const callbackUrl = getSafeCallbackUrl(requestedCallbackUrl);

        // Reload through the browser so the session cookie written by
        // NextAuth is included in the first protected dashboard request.
        window.location.assign(callbackUrl);
      }
    } catch (error: unknown) {
      console.error('Login failed:', error); // Log the full error object
      const authError = getAuthErrorDetails(
        error,
        'An unexpected error occurred during login. Please try again later.'
      );
      setError(authError.message);
      setCanRetry(
        [
          AuthErrorCode.SERVICE_UNAVAILABLE,
          AuthErrorCode.NETWORK_ERROR,
          AuthErrorCode.REQUEST_TIMEOUT,
        ].includes(authError.code)
      );
      setShowResendVerification(authError.code === 'EMAIL_NOT_VERIFIED');
    } finally {
      window.clearTimeout(slowRequestTimer);
      setShowSlowRequestHint(false);
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-3">
        <h2 className="text-center text-4xl font-black tracking-[-0.04em] text-slate-900 dark:text-white">
          Sign in to your account
        </h2>
        <p className="text-center text-[1.05rem] font-medium text-slate-500 dark:text-slate-300">
          Enter your username or email to continue
        </p>
      </div>

      {message && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-emerald-950/50">
          <div className="flex">
            <div className="shrink-0">
              <FaCheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-emerald-200">{message}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-emerald-950/50">
          <div className="text-sm text-green-700 dark:text-emerald-200">{success}</div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md bg-red-50 p-4 dark:bg-red-950/30"
        >
          <div className="flex">
            <div className="shrink-0">
              <FaExclamationCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
                {showResendVerification && (
                  <Link
                    href="/resend-verification"
                    className="ml-2 text-indigo-600 hover:text-indigo-500 underline dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    Resend verification email
                  </Link>
                )}
              </p>
              {/(username not found|no account found)/i.test(error) && (
                <p className="mt-2 text-sm text-red-800 dark:text-red-200">
                  Don't have an account?{' '}
                  <Link
                    href="/register"
                    className="font-semibold underline hover:text-red-600 dark:hover:text-red-100"
                  >
                    Sign up
                  </Link>
                </p>
              )}
              {canRetry && (
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                  className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-700 dark:bg-slate-800 dark:text-red-200 dark:hover:bg-slate-700"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {loading && showSlowRequestHint && (
        <p role="status" className="text-center text-sm text-gray-600 dark:text-slate-300">
          Sign-in is taking longer than usual. Please keep this page open; you can retry if it
          fails.
        </p>
      )}

      {/*
          method="post" is a deliberate safeguard: if this form is ever
          submitted natively (e.g. before React hydration completes, or if
          JS fails to load), credentials go out as a POST body instead of a
          GET query string. That keeps them out of the URL bar, browser
          history, Referer headers, and server access logs. The real submit
          path is still the onSubmit handler below, which preventDefaults
          and hands off to NextAuth's signIn().
        */}
      <form
        className="mt-8 space-y-6"
        method="post"
        autoComplete="on"
        onSubmit={handleSubmit}
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-[1.05rem] font-medium text-slate-700 dark:text-slate-200"
            >
              Username or Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                {isEmail ? (
                  <FaEnvelope className="h-5 w-5 text-slate-400 dark:text-slate-400" />
                ) : (
                  <FaUser className="h-5 w-5 text-slate-400 dark:text-slate-400" />
                )}
              </div>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={handleChange}
                aria-invalid={!!formErrors.identifier}
                aria-describedby={formErrors.identifier ? 'identifier-error' : undefined}
                onBlur={() => {
                  if (!formTouched.identifier) {
                    setFormTouched({ ...formTouched, identifier: true });
                    setFormErrors({
                      ...formErrors,
                      identifier: validateField('identifier', identifier),
                    });
                  }
                }}
                className={`block w-full rounded-xl border bg-white py-3.5 pl-11 pr-3 text-[1.05rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  formErrors.identifier
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-slate-300 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400'
                }`}
                placeholder="Enter your username or email"
              />
            </div>
            {formErrors.identifier && formTouched.identifier && (
              <p id="identifier-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {formErrors.identifier}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[1.05rem] font-medium text-slate-700 dark:text-slate-200"
            >
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <FaLock className="h-5 w-5 text-slate-400 dark:text-slate-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={handleChange}
                aria-invalid={!!formErrors.password}
                aria-describedby={formErrors.password ? 'password-error' : undefined}
                onBlur={() => {
                  if (!formTouched.password) {
                    setFormTouched({ ...formTouched, password: true });
                    setFormErrors({
                      ...formErrors,
                      password: validateField('password', password),
                    });
                  }
                }}
                className={`block w-full rounded-xl border bg-white py-3.5 pl-11 pr-11 text-[1.05rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  formErrors.password
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-slate-300 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-300"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <FaEyeSlash className="h-5 w-5" />
                ) : (
                  <FaEye className="h-5 w-5" />
                )}
              </button>
            </div>
            {formErrors.password && formTouched.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {formErrors.password}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="rememberMe" className="flex cursor-pointer items-center gap-3">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="h-5 w-5 cursor-pointer rounded-md border border-slate-300 bg-white accent-blue-600"
            />
            <span className="text-[1.05rem] text-slate-700 dark:text-slate-200">Remember me</span>
          </label>

          <div className="text-sm font-medium">
            <Link
              href="/forgot-password"
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className={`group relative flex w-full justify-center rounded-xl border border-transparent bg-[#0d6efd] px-4 py-4 text-[1.15rem] font-bold text-white shadow-[0_10px_18px_rgba(13,110,253,0.25)] transition-colors hover:bg-[#0b5ed7] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
              loading ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            <>
              {loading && <FaSpinner className="mr-2 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </>
          </button>
        </div>

        <div className="my-5 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-300" aria-hidden="true" />
          <span className="text-[0.78rem] font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Or continue with
          </span>
          <div className="h-px flex-1 bg-slate-300" aria-hidden="true" />
        </div>

        <div>
          <button
            type="button"
            onClick={() => void handleProviderSignIn()}
            disabled={loading || socialLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[1.1rem] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <FaGoogle className="text-[1.7rem]" />
            <span>{socialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
          </button>
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            New Google accounts will be asked to accept the Terms of Service and Privacy Policy after sign-in.
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[1.05rem] text-slate-600 dark:text-slate-300">
            Don't have an account?{' '}
            <Link
              href="/register"
              className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
