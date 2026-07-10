'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const [errorType, setErrorType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('An authentication error occurred');

  useEffect(() => {
    // Get error information from URL parameters
    const error = searchParams.get('error');
    setErrorType(error);

    // Set appropriate error message based on error type
    switch (error) {
      case 'CredentialsSignin':
        setErrorMessage('The username or password you entered is incorrect. Please try again.');
        break;
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'EmailCreateAccount':
      case 'Callback':
        setErrorMessage(
          'We encountered an issue with your social login. Please try again or use a different sign-in method.'
        );
        break;
      case 'OAuthAccountNotLinked':
        setErrorMessage(
          'This email is already associated with another account. Please sign in using your original sign-in method.'
        );
        break;
      case 'EmailSignin':
        setErrorMessage(
          "We couldn't send the verification email. Please try again later or contact support if the issue persists."
        );
        break;
      case 'Configuration':
        setErrorMessage(
          "We're experiencing technical difficulties. Our team has been notified. Please try again later."
        );
        break;
      case 'AccessDenied':
        setErrorMessage(
          "You don't have permission to access this resource. Please contact your administrator if you believe this is an error."
        );
        break;
      case 'Verification':
        setErrorMessage(
          'Your verification link has expired or has already been used. Please request a new verification email.'
        );
        break;
      case 'SessionRequired':
        setErrorMessage('Please sign in to access this page.');
        break;
      case 'Default':
        setErrorMessage(
          'An unexpected error occurred. Please try again or contact support if the issue persists.'
        );
        break;
      default:
        setErrorMessage(
          'We encountered an unexpected error. Please try again or contact support if the issue persists.'
        );
        break;
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-red-50 border-b border-red-100">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
            <CardTitle className="text-red-700">Authentication Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-gray-700">{errorMessage}</p>

            {errorType && (
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Error code: {errorType}
              </div>
            )}

            <div className="flex flex-col space-y-2 pt-4">
              <Link
                href="/login"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Return to Login
              </Link>

              <Link
                href="/"
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Homepage
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader className="bg-red-50 border-b border-red-100">
              <div className="flex items-center">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                <CardTitle className="text-red-700">Loading error details...</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700">Retrieving the latest error information.</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
