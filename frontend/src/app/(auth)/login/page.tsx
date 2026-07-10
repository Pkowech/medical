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
} from 'react-icons/fa';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface FormErrors {
  identifier?: string;
  password?: string;
}

function LoginContent() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const [error, setError] = useState<string | React.ReactNode>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formTouched, setFormTouched] = useState({
    identifier: false,
    password: false,
  });
  const [_loginAttempts, setLoginAttempts] = useState(0);
  const [message, setMessage] = useState('');

  // Determine if identifier is an email
  const isEmail = identifier.includes('@');

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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
      setError('Please fix the errors in the form before submitting.');
      setLoading(false);
      return;
    }

    // Increment login attempts
    setLoginAttempts(prev => prev + 1);

    try {
      const result = await login(identifier, password);

      if (result?.error) {
        // The error from NextAuth's signIn will be a string like "CredentialsSignin"
        // We can provide a more user-friendly message.
        throw new Error('Invalid username/email or password.');
      } else {
        setSuccess('Login successful! Redirecting...');
        // NextAuth.js will handle the redirection based on the configuration in nextauth.ts
        // No explicit client-side redirection needed here.
      }
    } catch (error: unknown) {
      console.error('Login failed:', error); // Log the full error object
      let errorMessage = 'An unexpected error occurred during login. Please try again later.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your username or email to continue
          </p>
        </div>

        {message && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="shrink-0">
                <FaCheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{message}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="shrink-0">
                <FaExclamationCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {typeof error === 'string' ? error : (error && typeof error === 'object' && 'message' in error ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message)) : JSON.stringify(error))}
                  {typeof error === 'string' && error.includes('not verified') && (
                    <Link
                      href="/auth/resend-verification"
                      className="ml-2 text-indigo-600 hover:text-indigo-500"
                    >
                      Resend verification email
                    </Link>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {isEmail ? (
                    <FaEnvelope className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaUser className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={handleChange}
                  onBlur={() => {
                    if (!formTouched.identifier) {
                      setFormTouched({ ...formTouched, identifier: true });
                      setFormErrors({
                        ...formErrors,
                        identifier: validateField('identifier', identifier),
                      });
                    }
                  }}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border ${
                    formErrors.identifier
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  } rounded-md placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm`}
                  placeholder="Enter your username or email"
                />
              </div>
              {formErrors.identifier && formTouched.identifier && (
                <p className="mt-1 text-sm text-red-600">{formErrors.identifier}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={handleChange}
                  onBlur={() => {
                    if (!formTouched.password) {
                      setFormTouched({ ...formTouched, password: true });
                      setFormErrors({
                        ...formErrors,
                        password: validateField('password', password),
                      });
                    }
                  }}
                  className={`appearance-none block w-full pl-10 pr-10 py-2 border ${
                    formErrors.password
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  } rounded-md placeholder-gray-500 text-gray-900 focus:outline-none sm:text-sm`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {formErrors.password && formTouched.password && (
                <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <>
                {loading && <FaSpinner className="animate-spin mr-2" />}
                Sign in
              </>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
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
