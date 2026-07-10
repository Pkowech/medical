'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { FormField } from '@/features/auth/components/FormField';
import { useToast } from '@/shared/components/ui/use-toast';
import { userService } from '@/features/profile/services/userService';
import { User as UserIcon, CheckCircle2 } from 'lucide-react';
import type { User } from '@/shared/types';

interface FinishSetupData {
  phoneNumber?: string;
  bio?: string;
  location?: string;
  specialization?: string;
  yearOfExperience?: number | string;
}

export default function FinishSetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FinishSetupData>({
    phoneNumber: '',
    bio: '',
    location: '',
    specialization: '',
    yearOfExperience: '',
  });

  // Fetch user profile on mount to show current data
  useEffect(() => {
    const fetchUserData = async () => {
      setIsFetching(true);
      setFetchError(null);

      if (!session?.user?.id) {
        const errorMsg = 'Session not initialized: missing user ID';
        console.warn(errorMsg);

        setFetchError(errorMsg);
        setIsFetching(false);
        return;
      }

      try {

        const user = await userService.getUserProfile(session.user.id);
        


        setFormData({
          phoneNumber: user.phoneNumber || '',
          bio: user.bio || '',
          location: user.location || '',
          specialization: user.specialization || '',
          yearOfExperience: user.yearOfExperience || '',
        });
        setFetchError(null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching profile';
        const backendError = error as { status?: number; response?: { data?: unknown } };
        console.error('[FinishSetup] Error fetching user data:', {
          message: errorMessage,
          status: backendError?.status,
          response: backendError?.response?.data,
          fullError: error,
        });
        setFetchError(errorMessage);
        
        toast({
          title: 'Warning',
          description: 'Could not load existing profile data. You can still fill in the form to create your profile.',
          variant: 'destructive',
        });
      } finally {
        setIsFetching(false);
      }
    };

    fetchUserData();
  }, [session?.user?.id, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) {
      const errorMsg = 'User session not found';
      console.error('[FinishSetup]', errorMsg, { hasSession: !!session, hasUser: !!session?.user });
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Only send fields that have values
      const updateData: Partial<FinishSetupData> = {};
      if (formData.phoneNumber) updateData.phoneNumber = formData.phoneNumber;
      if (formData.bio) updateData.bio = formData.bio;
      if (formData.location) updateData.location = formData.location;
      if (formData.specialization) updateData.specialization = formData.specialization;
      if (formData.yearOfExperience) updateData.yearOfExperience = parseInt(String(formData.yearOfExperience), 10);



      await userService.updateUserProfile(session.user.id, updateData as Partial<User>);



      toast({
        title: 'Success!',
        description: 'Profile setup completed successfully',
        duration: 3000,
      });

      setTimeout(() => {
        router.push('/onboarding');
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save profile';
      const backendError = error as { status?: number; response?: { data?: unknown } };
      console.error('[FinishSetup] Error saving profile:', {
        message: errorMessage,
        status: backendError?.status,
        response: backendError?.response?.data,
        fullError: error,
      });
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {

      // Just redirect to dashboard without saving
      router.push('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to proceed';
      console.error('[FinishSetup] Error skipping setup:', error);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsSkipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <UserIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add optional information to help personalize your experience
          </p>
        </div>

        {/* Main Card */}
        <Card className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-gray-100 dark:border-slate-700 shadow-lg">
          <CardHeader className="border-b border-gray-100 dark:border-slate-700">
            <CardTitle className="text-gray-900 dark:text-white">
              Profile Information
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Help others find and connect with you
            </p>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Loading State */}
            {isFetching && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-b-transparent mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading your profile...</p>
              </div>
            )}

            {/* Error State with Details */}
            {fetchError && !isFetching && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                  Could not load existing profile
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{fetchError}</p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                  Don't worry! You can still fill in the form below to create or update your profile.
                </p>
              </div>
            )}

            {/* Form - visible even if fetch failed */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Personal Information Section */}
              <div className="bg-gray-50/50 dark:bg-slate-700/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Personal Information
                </h3>

                <FormField
                  label="Phone Number"
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber || ''}
                  onChange={handleChange}
                  placeholder="e.g., +1 (555) 123-4567"
                  helperText="Optional • helps with account recovery"
                  disabled={isLoading}
                />

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio || ''}
                    onChange={handleChange}
                    placeholder="Tell us about yourself..."
                    disabled={isLoading}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Optional • max 500 characters
                  </p>
                </div>

                <div className="mt-4">
                  <FormField
                    label="Location"
                    type="text"
                    name="location"
                    value={formData.location || ''}
                    onChange={handleChange}
                    placeholder="City, Country"
                    helperText="Optional • helps connect with others nearby"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="bg-gray-50/50 dark:bg-slate-700/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Professional Information
                </h3>

                <FormField
                  label="Specialization"
                  type="text"
                  name="specialization"
                  value={formData.specialization || ''}
                  onChange={handleChange}
                  placeholder="e.g., Cardiology, Surgery, Internal Medicine"
                  helperText="Optional • your area of expertise"
                  disabled={isLoading}
                />

                <div className="mt-4">
                  <FormField
                    label="Years of Experience"
                    type="number"
                    name="yearOfExperience"
                    value={formData.yearOfExperience?.toString() || ''}
                    onChange={handleChange}
                    placeholder="0-70"
                    min="0"
                    max="70"
                    helperText="Optional • your professional experience in years"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 mt-8 border-t border-gray-100 dark:border-slate-700">
                <Button
                  type="submit"
                  disabled={isLoading || isFetching}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-b-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSkipping || isFetching}
                  onClick={handleSkip}
                  className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSkipping ? 'Processing...' : 'Complete Later'}
                </Button>
              </div>

              {/* Info Message */}
              <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
                <p>
                  You can update this information anytime from your profile settings. None of these fields are required.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
