'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { User, Edit, Award, Clock, Settings, BookOpen, TrendingUp, Target } from 'lucide-react';
import useRequireAuth from '@/features/auth/hooks/useRequireAuth'; // Keep this for session management
import { userService } from '@/features/profile/services/userService';
import { useRouter } from 'next/navigation';
import { ProfileCompletenessBar } from '@/features/profile/components/ProfileCompletenessBar';
import type { LocalUserProfile } from '@/shared/types/profileInterface';

export default function ProfilePage() {
  const { isLoading, session } = useRequireAuth();

  const [profile, setProfile] = useState<LocalUserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    bio: '',
    location: '',
    specialization: '',
    yearOfExperience: 0,
    profileImage: undefined,
    coursesEnrolled: 0,
    coursesCompleted: 0,
    totalStudyTime: 0,
    averageScore: 0,
  });
  const router = useRouter(); // Initialize useRouter here

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user?.id) {
        try {
          const userProfile = await userService.getUserProfile(session.user.id);
          


          if (!userProfile) {
            return;
          }

          setProfile({
            id: userProfile.id,
            // Use profile data, fallback to session, then empty string
            firstName: userProfile.firstName || (session.user as { firstName?: string }).firstName || '',
            lastName: userProfile.lastName || (session.user as { lastName?: string }).lastName || '',
            email: userProfile.email || session.user.email || '',
            phoneNumber: userProfile.phoneNumber || '',
            bio: userProfile.bio || '',
            location: userProfile.location || '',
            specialization: userProfile.specialization || '',
            yearOfExperience: userProfile.yearOfExperience ?? 0,
            profileImage: userProfile.profileImage || session.user.image || undefined,
            coursesEnrolled: userProfile.stats?.coursesEnrolled || 0,
            coursesCompleted: userProfile.stats?.coursesCompleted || 0,
            totalStudyTime: userProfile.stats?.totalStudyTime || 0,
            averageScore: userProfile.stats?.averageScore || 0,
          });
        } catch (error: unknown) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Error fetching profile:', error);
          }
        }
      }
    };

    fetchProfile();
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-gray-50/50 dark:bg-slate-900/50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Helper to get formatted name
  const getDisplayName = () => {
    const name = `${profile.firstName} ${profile.lastName}`.trim();
    return name || session?.user?.name || 'User';
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50/50 dark:bg-slate-900/50 min-h-screen">
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
            {profile.profileImage ? (
              <Image src={profile.profileImage as string} alt={getDisplayName()} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-gray-400 dark:text-slate-500" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white capitalize">{getDisplayName()}</h1>
            <p className="text-gray-600 dark:text-slate-400">{profile.email}</p>
          </div>
        </div>
        <Button onClick={() => router.push('/profile/edit')} className="w-full md:w-auto">
          <Edit className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </div>

      {/* Profile Completeness Indicator */}
      <div className="mb-8">
        <ProfileCompletenessBar profile={profile} variant="full" />
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Enrolled</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{profile.coursesEnrolled || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{profile.coursesCompleted || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Study Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {profile.totalStudyTime ? Math.round(profile.totalStudyTime / 60) : 0}h
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Avg Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {profile.averageScore ? Math.round(profile.averageScore) : 0}%
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <User className="h-5 w-5 mr-3 text-blue-500" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Full Name</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">{`${profile.firstName} ${profile.lastName}`.trim() || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Email Address</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Phone Number</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">{profile.phoneNumber || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Location</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">{profile.location || 'Not set'}</p>
              </div>
            </div>
            {profile.bio && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Bio</p>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Award className="h-5 w-5 mr-3 text-purple-500" />
              Academic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Specialization</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">{profile.specialization || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Experience Level</p>
                <p className="text-base font-medium text-gray-900 dark:text-slate-200">
                  {profile.yearOfExperience !== undefined && profile.yearOfExperience !== null
                    ? `${profile.yearOfExperience} Year${profile.yearOfExperience === 1 ? '' : 's'}`
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6 text-gray-900 dark:text-white">Account Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="hover:border-blue-500/50 transition-colors bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Settings className="h-5 w-5 mr-2 text-gray-400" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Manage your account settings, notifications, and privacy preferences.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/profile/settings')}>Go to Settings</Button>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-500/50 transition-colors bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Award className="h-5 w-5 mr-2 text-gray-400" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              View your earned achievements, badges, and milestones progress.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/profile/achievements')}>View Achievements</Button>
          </CardContent>
        </Card>

        <Card className="hover:border-green-500/50 transition-colors bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-gray-100 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900 dark:text-white">
              <Clock className="h-5 w-5 mr-2 text-gray-400" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Manage your active login sessions and verify connected devices.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/profile/sessions')}>Manage Sessions</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
