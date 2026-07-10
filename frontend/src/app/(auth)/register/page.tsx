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

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { register, isLoading, error } = useAuthStore();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
      useAuthStore.getState().clearError(); // Clear the error after showing the toast
    }
  }, [error, toast]);

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

    // Basic client-side validation
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.acceptTerms) {
      toast({
        title: 'Error',
        description: 'You must accept the terms and conditions.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Removed name splitting logic
      // const [firstName, ...lastNameParts] = formData.name.split(' ');
      // const lastName = lastNameParts.join(' ') || firstName; // If only one name, use it as last name

      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        role: Role.student,
        confirmPassword: formData.confirmPassword,
        acceptTerms: formData.acceptTerms,
      });
      router.push('/finish-setup');
    } catch (err: unknown) {
      let errorMessage = 'An unexpected error occurred during registration.';
      let fieldErrors: Record<string, string> = {};

      if (err instanceof Error) {
        errorMessage = err.message; // Use the message from the re-thrown Error
      }

      // If there are specific backend validation errors, they might be in a nested structure
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data
      ) {
        const responseData = err.response.data as {
          message?: string;
          errors?: Record<string, string>;
        };
        errorMessage = responseData.message || errorMessage;
        if (responseData.errors) {
          fieldErrors = responseData.errors;
        }
      } else if (
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('No response received')
      ) {
        errorMessage = `Unable to connect to the authentication service. Please ensure the backend is running and accessible.`;
      }

      if (
        errorMessage.includes('Email or username already exists') ||
        fieldErrors.email ||
        fieldErrors.username
      ) {
        toast({
          title: 'Registration Failed',
          description: (
            <p>
              An account with this email or username already exists. Please{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
              .
            </p>
          ),
          variant: 'destructive',
          duration: 5000,
        });
      } else {
        toast({
          title: 'Registration Failed',
          description: errorMessage,
          variant: 'destructive',
          duration: 5000,
        });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <AuthForm
      title="Sign Up"
      subtitle="Create your account to get started"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitText="Create Account"
      footer={
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <FormField
          label="First Name" // Changed label
          type="text"
          name="firstName" // Changed name
          value={formData.firstName} // Changed value
          onChange={handleChange}
          required
          placeholder="Enter your first name" // Changed placeholder
        />
        <FormField
          label="Last Name" // Added
          type="text"
          name="lastName" // Added
          value={formData.lastName} // Added
          onChange={handleChange}
          required
          placeholder="Enter your last name" // Added
        />

        <FormField
          label="Email Address"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder="Enter your email"
        />

        <FormField
          label="Username"
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          placeholder="Create a username"
        />

        <FormField
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          placeholder="Create a password"
          helperText="Must be at least 8 characters with uppercase, lowercase, number, and special character"
        />

        <FormField
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
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
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="acceptTerms" className="text-gray-600 dark:text-gray-300">
              I agree to the{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700 font-medium">
                Terms of Service
              </Link>
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700 font-medium">
                Privacy Policy
              </Link>
            </label>
          </div>
        </div>
      </div>
    </AuthForm>
  );
}
