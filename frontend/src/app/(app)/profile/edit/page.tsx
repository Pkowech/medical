'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import useRequireAuth from '@/features/auth/hooks/useRequireAuth';
import { Camera, User, Award, AlertCircle } from 'lucide-react';
import { userService } from '@/features/profile/services/userService';
import { useRouter } from 'next/navigation';
import { FormFieldWithValidation } from '@/features/profile/components/FormFieldWithValidation';
import { ProfileCompletenessBar } from '@/features/profile/components/ProfileCompletenessBar';
import {
  validateProfile,
  validateField,
  validateImageFile,
} from '@/features/profile/utils/profileValidation';
import { useUnsavedChanges } from '@/features/profile/hooks/useUnsavedChanges';
import type { LocalUserProfile } from '@/shared/types/profileInterface';

interface ValidationError {
  field?: string;
  property?: string;
  name?: string;
  errors?: string[] | Record<string, string>;
  constraints?: Record<string, string>;
  messages?: string[];
}

// Type guard to check for a specific error structure
function isBackendError(
  error: unknown
): error is { response: { data: { message: string | string[]; errors: ValidationError[] } } } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'response' in error &&
    error.response !== null &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data !== null &&
    typeof error.response.data === 'object'
  );
}

export default function EditProfilePage() {
  const { isLoading: _isLoading, session } = useRequireAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<LocalUserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    specialization: '',
    yearOfExperience: 0,
    location: '',
    phoneNumber: '',
    profileImage: undefined,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [validationState, setValidationState] = useState<Record<string, boolean>>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Track unsaved changes
  const { hasUnsavedChanges, markAsSaved, reset } = useUnsavedChanges(profile, !isLoadingProfile);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      if (session?.user?.id) {
        try {
          const userProfile = await userService.getUserProfile(session.user.id);
          


          if (!userProfile) {
            setSaveMessage('Profile data not found');
            setIsLoadingProfile(false);
            return;
          }
          
          const fetchedProfile: LocalUserProfile = {
            id: userProfile.id,
            firstName: userProfile.firstName || (session.user as { firstName?: string }).firstName || '',
            lastName: userProfile.lastName || (session.user as { lastName?: string }).lastName || '',
            email: userProfile.email || session.user.email || '',
            bio: userProfile.bio || '',
            specialization: userProfile.specialization || '',
            yearOfExperience: userProfile.yearOfExperience ?? 0,
            location: userProfile.location || '',
            phoneNumber: userProfile.phoneNumber || '',
            profileImage: userProfile.profileImage || session.user.image || undefined,
          };
          
          setProfile(fetchedProfile);
          setPreviewImage(fetchedProfile.profileImage || session.user.image || null);
          setIsLoadingProfile(false);
        } catch (error: unknown) {
          console.error('Error fetching profile:', error);
          setSaveMessage(`Error fetching profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsLoadingProfile(false);
        }
      } else {
        console.warn('No session user ID available');
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [session?.user?.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    
    // Real-time validation
    const fieldValidationErrors = validateField(name, value);
    if (fieldValidationErrors.length === 0) {
      setValidationState(prev => ({ ...prev, [name]: true }));
    } else {
      setValidationState(prev => ({ ...prev, [name]: false }));
    }
    
    // Clear field-level errors for this UI field when user edits it
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error || 'Invalid image');
      return;
    }
    setImageError('');

    if (!session?.user?.id) {
      setImageError('Not authenticated');
      return;
    }

    // Show a local preview immediately for responsiveness
    const localUrl = URL.createObjectURL(file);
    setPreviewImage(localUrl);

    // Upload to R2 via backend
    setIsUploadingImage(true);
    try {
      const { url } = await userService.uploadProfileImage(session.user.id, file);
      // Replace blob URL with the signed R2 URL
      setPreviewImage(url);
      setProfile(prev => ({ ...prev, profileImage: url }));
    } catch {
      setImageError('Image upload failed. Please try again.');
      setPreviewImage(profile.profileImage || null);
    } finally {
      setIsUploadingImage(false);
      // Revoke the blob URL to free memory
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleSaveProfile = async () => {
    // First validate the entire profile
    const validation = validateProfile(profile);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSaveMessage('Please fix the errors below');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      if (!session?.user?.id) {
        setSaveMessage('Error: User not authenticated');
        return;
      }

      // Map to backend UpdateUserDto expected fields
      // Note: profileImage is already saved server-side by uploadProfileImage;
      // we only include the stored key/url, not a raw data URL.
      const updatePayload = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        bio: profile.bio || undefined,
        location: profile.location || undefined,
        phoneNumber: profile.phoneNumber || undefined,
        specialization: profile.specialization || undefined,
        yearOfExperience: typeof profile.yearOfExperience === 'number' ? profile.yearOfExperience : undefined,
      };

      await userService.updateUserProfile(session.user.id, updatePayload);

      setSaveMessage('Profile saved successfully');
      setFieldErrors({});
      markAsSaved();
      setTimeout(() => {
        setSaveMessage('');
        router.push('/profile');
      }, 2000);
    } catch (error: unknown) {
      // Try to surface server validation errors if available
      let friendly = 'Error saving profile';
      if (isBackendError(error)) {
        const resp = error.response.data;
        // Common NestJS/axios shapes: { message: '...', statusCode: 400 } or { message: ['a','b'] }
        if (Array.isArray(resp.message)) {
          friendly = resp.message.join('; ');
        } else if (typeof resp.message === 'string') {
          friendly = resp.message;
        } else if (resp.errors) {
          // Validation pipe may return an object with constraints
          try {
            // resp.errors from our backend is an array of { field, errors: [] }
            if (Array.isArray(resp.errors)) {
              const byField: Record<string, string[]> = {};
              resp.errors.forEach(err => {
                const field = err.field || err.property || err.name || 'general';
                const errs = err.errors || err.constraints || err.messages || [];
                byField[field] = Array.isArray(errs) 
                  ? errs.map(e => typeof e === 'object' ? JSON.stringify(e) : String(e)) 
                  : [typeof errs === 'object' ? JSON.stringify(errs) : String(errs)];
              });

              setFieldErrors(byField);

              const all = Object.values(byField).flatMap(v => v as string[]);
              if (all.length) friendly = all.join('; ');
            } else {
              const all = Object.values(resp.errors || {}).flatMap(
                (v: { constraints: Record<string, string> } | unknown) =>
                  v && typeof v === 'object' && 'constraints' in v && v.constraints
                    ? Object.values(v.constraints)
                    : []
              );
              if (all.length) friendly = all.join('; ');
            }
          } catch {}
        }
      } else if (error instanceof Error) {
        friendly = error.message;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('Error saving profile:', error);
      }
      setSaveMessage(friendly);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-gray-50/50 dark:bg-slate-900/50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50/50 dark:bg-slate-900/50 min-h-screen space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Profile</h1>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={() => {
                reset();
                window.location.reload();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
            >
              Reset
            </button>
          )}
          <Button 
            variant="outline" 
            onClick={() => router.push('/profile')} 
            className="dark:border-slate-700 dark:text-slate-300"
            disabled={hasUnsavedChanges}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Profile Completeness Indicator */}
      <ProfileCompletenessBar profile={profile} variant="full" />

      {/* Warning for unsaved changes */}
      {hasUnsavedChanges && (
        <div className="rounded-lg border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100 text-sm">
                Unsaved changes
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                You have unsaved changes. Click Save to keep them or Reset to discard.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900 dark:text-white">
            <User className="h-5 w-5 mr-2 text-blue-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Profile Image */}
            <div className="md:col-span-2 flex flex-col items-center mb-4">
              <div className="relative">
                <div className="h-32 w-32 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-400 dark:text-slate-600 text-4xl font-bold overflow-hidden transition-all hover:border-blue-500/50">
                  {previewImage ? (
                    <Image
                      src={previewImage}
                      alt="Profile"
                      width={128}
                      height={128}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.firstName?.charAt(0) || session?.user?.name?.charAt(0) || 'U'
                  )}
                </div>
                {/* Upload spinner overlay */}
                {isUploadingImage && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <label
                  htmlFor="avatar-upload"
                  className={`absolute bottom-0 right-0 p-2 rounded-full cursor-pointer transition-colors ${
                    isUploadingImage
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={isUploadingImage}
                    aria-label="Upload profile picture"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-3">
                {isUploadingImage ? 'Uploading…' : 'Click the camera icon to upload a profile picture'}
              </p>
              {imageError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">{imageError}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">
                Max 5 MB · JPEG, PNG, WebP, GIF · Stored optimised (400×400 WebP)
              </p>
            </div>

            {/* First Name */}
            <div>
              <FormFieldWithValidation
                label="First Name"
                name="firstName"
                value={profile.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                required={true}
                errors={fieldErrors.firstName}
                helpText="Your first name"
                isValid={validationState.firstName}
              />
            </div>

            {/* Last Name */}
            <div>
              <FormFieldWithValidation
                label="Last Name"
                name="lastName"
                value={profile.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                required={true}
                errors={fieldErrors.lastName}
                helpText="Your last name"
                isValid={validationState.lastName}
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <FormFieldWithValidation
                label="Email"
                name="email"
                value={profile.email}
                onChange={() => {}}
                placeholder="Your email address"
                disabled={true}
                helpText="Email cannot be changed"
              />
            </div>

            {/* Bio */}
            <div className="md:col-span-2">
              <FormFieldWithValidation
                label="Bio"
                name="bio"
                value={profile.bio || ''}
                onChange={handleChange}
                placeholder="Tell us about yourself..."
                isTextarea={true}
                rows={4}
                maxLength={500}
                errors={fieldErrors.bio}
                helpText="Share your background and interests"
                isValid={validationState.bio}
              />
            </div>

            {/* Phone */}
            <div>
              <FormFieldWithValidation
                label="Phone Number"
                name="phoneNumber"
                value={profile.phoneNumber || ''}
                onChange={handleChange}
                type="tel"
                placeholder="Enter your phone number"
                errors={fieldErrors.phoneNumber}
                helpText="Optional • e.g., +1 (555) 123-4567"
                isValid={validationState.phone}
              />
            </div>

            {/* Location */}
            <div>
              <FormFieldWithValidation
                label="Location"
                name="location"
                value={profile.location || ''}
                onChange={handleChange}
                placeholder="City, Country"
                errors={fieldErrors.location}
                helpText="Optional • helps connect with others nearby"
                isValid={validationState.location}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Information Section */}
      <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-500" />
            Academic & Professional Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Specialization */}
            <div>
              <FormFieldWithValidation
                label="Specialization"
                name="specialization"
                value={profile.specialization || ''}
                onChange={handleChange}
                placeholder="e.g., Cardiology, Surgery"
                errors={fieldErrors.specialization}
                helpText="Optional • your area of focus"
                isValid={validationState.specialization}
              />
            </div>

            {/* Years of Experience */}
            <div>
              <FormFieldWithValidation
                label="Years of Experience"
                name="yearOfExperience"
                value={profile.yearOfExperience?.toString() || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                  const val = (e.target as HTMLInputElement).value;
                  const numValue = val ? Math.max(0, Math.min(70, parseInt(val, 10))) : 0;
                  setProfile(prev => ({ ...prev, yearOfExperience: numValue }));
                  const fieldValidationErrors = validateField('yearOfExperience', numValue.toString());
                  setValidationState(prev => ({
                    ...prev,
                    yearOfExperience: fieldValidationErrors.length === 0
                  }));
                  setFieldErrors(prev => {
                    const copy = { ...prev };
                    delete copy.yearOfExperience;
                    return copy;
                  });
                }}
                type="number"
                placeholder="0-70 years"
                errors={fieldErrors.yearOfExperience}
                helpText="Optional • your years of professional experience (0-70)"
                isValid={validationState.yearOfExperience}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save/Status Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          {saveMessage && (
            <div
              className={`py-3 px-4 rounded-lg text-sm font-medium shadow-sm transition-all animate-in fade-in slide-in-from-top-2 flex items-start gap-3 ${
                saveMessage.includes('successfully')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800/50'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800/50'
              }`}
            >
              {saveMessage.includes('successfully') ? (
                <div className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{saveMessage}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/profile')}
            disabled={isSaving}
            className="dark:border-slate-700 dark:text-slate-300"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSaveProfile}
            disabled={isSaving || (!hasUnsavedChanges && !saveMessage)}
            className={isSaving ? 'opacity-70 cursor-not-allowed' : ''}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
