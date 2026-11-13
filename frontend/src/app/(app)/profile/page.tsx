'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { User, Edit, Award, Clock, Settings, BookOpen, TrendingUp, Target, ArrowRight } from 'lucide-react';
import useRequireAuth from '@/features/auth/hooks/useRequireAuth'; // Keep this for session management
import { userService } from '@/features/profile/services/userService';
import {
  onboardingService,
  type OnboardingStatusResponse,
} from '@/features/onboarding/services/onboardingService';
import { useRouter } from 'next/navigation';
import { ProfileCompletenessBar } from '@/features/profile/components/ProfileCompletenessBar';
import type { LocalUserProfile } from '@/shared/types/profileInterface';
import { healthcareFieldLabel } from '@/shared/utils/healthcareProfile';

export default function ProfilePage() {
  const { isLoading, session } = useRequireAuth();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const [profile, setProfile] = useState<LocalUserProfile>({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    bio: '',
    location: '',
    careerStage: '',
    healthcareField: '',
    studyYear: null,
    specialization: '',
    yearOfExperience: null,
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
          setProfileError(null);
          const userProfile = await userService.getMyProfile();
          if (!userProfile) {
            return;
          }

          setProfile({
            id: userProfile.id,
            username: userProfile.username || session.user.username || '',
            // Use profile data, fallback to session, then empty string
            firstName: userProfile.firstName || (session.user as { firstName?: string }).firstName || '',
            lastName: userProfile.lastName || (session.user as { lastName?: string }).lastName || '',
            email: userProfile.email || session.user.email || '',
            phoneNumber: userProfile.phoneNumber || '',
            bio: userProfile.bio || '',
            location: userProfile.location || '',
            careerStage: userProfile.careerStage || '',
            healthcareField: userProfile.healthcareField || '',
            studyYear: userProfile.studyYear ?? null,
            specialization: userProfile.specialization || '',
            yearOfExperience: userProfile.yearOfExperience ?? null,
            profileImage: userProfile.profileImage && userProfile.profileImage.trim() !== ''
              ? userProfile.profileImage
              : (session.user.image && session.user.image.trim() !== '' ? session.user.image : undefined),
            coursesEnrolled: userProfile.stats?.coursesEnrolled || 0,
            coursesCompleted: userProfile.stats?.coursesCompleted || 0,
            totalStudyTime: userProfile.stats?.totalStudyTime || 0,
            averageScore: userProfile.stats?.averageScore || 0,
          });
          if (!userProfile.analyticsAvailable) {
            setProfileError('Learning statistics are temporarily unavailable.');
          }
        } catch {
          setProfileError('Unable to load your profile. Please try again.');
        }
      }
    };

    fetchProfile();
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;

    let active = true;
    onboardingService
      .getStatus()
      .then(status => {
        if (active) setOnboardingStatus(status);
      })
      .catch(error => {
        console.error('Error fetching onboarding preferences:', error);
        if (active) setOnboardingError('Learning preferences are temporarily unavailable.');
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] bg-background/50 dark:bg-card/50">
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
    <div className="container mx-auto px-4 py-8 bg-background/50 dark:bg-card/50 min-h-screen">
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-card dark:bg-card shadow-sm border border-border dark:border-border flex items-center justify-center overflow-hidden">
            {profile.profileImage ? (
              <Image src={profile.profileImage as string} alt={getDisplayName()} width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground dark:text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground dark:text-foreground capitalize">{getDisplayName()}</h1>
            <p className="text-muted-foreground dark:text-muted-foreground">{profile.email}</p>
            {profile.username && (
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                @{profile.username}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => router.push('/profile/edit')} className="w-full md:w-auto">
          <Edit className="mr-2 h-4 w-4" /> Edit Profile
        </Button>
      </div>

      {profileError && (
        <div className="mb-6 rounded-md border border-destructive/30 p-3 text-sm text-destructive" role="alert">
          {profileError}
        </div>
      )}

      {/* Profile Completeness Indicator */}
      <div className="mb-8">
        <ProfileCompletenessBar profile={profile} variant="full" />
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase">Enrolled</p>
                <p className="text-2xl font-bold text-foreground dark:text-foreground mt-1">{profile.coursesEnrolled || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase">Completed</p>
                <p className="text-2xl font-bold text-foreground dark:text-foreground mt-1">{profile.coursesCompleted || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase">Study Time</p>
                <p className="text-2xl font-bold text-foreground dark:text-foreground mt-1">
                  {profile.totalStudyTime ? Math.round(profile.totalStudyTime / 60) : 0}h
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase">Avg Score</p>
                <p className="text-2xl font-bold text-foreground dark:text-foreground mt-1">
                  {profile.averageScore ? Math.round(profile.averageScore) : 0}%
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <User className="h-5 w-5 mr-3 text-blue-500" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Full Name</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">{`${profile.firstName} ${profile.lastName}`.trim() || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Email Address</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">{profile.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Username</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">
                  {profile.username ? `@${profile.username}` : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Phone Number</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">{profile.phoneNumber || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">{profile.location || 'Not set'}</p>
              </div>
            </div>
            {profile.bio && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Bio</p>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <Award className="h-5 w-5 mr-3 text-purple-500" />
              Healthcare Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Healthcare field</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">
                  {healthcareFieldLabel(profile.healthcareField) || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Current stage</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">
                  {profile.careerStage === 'student'
                    ? 'Student or trainee'
                    : profile.careerStage === 'postgraduate'
                      ? 'Postgraduate / resident / trainee'
                    : profile.careerStage === 'professional'
                      ? 'Healthcare professional'
                      : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">Specialty or area of interest</p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">{profile.specialization || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  {profile.careerStage === 'student' || profile.careerStage === 'postgraduate'
                    ? profile.careerStage === 'postgraduate' ? 'Training year' : 'Year of study'
                    : 'Professional experience'}
                </p>
                <p className="text-base font-medium text-foreground dark:text-muted-foreground">
                  {profile.careerStage === 'student' || profile.careerStage === 'postgraduate'
                    ? profile.studyYear ? `Year ${profile.studyYear}` : 'Not set'
                    : profile.careerStage === 'professional' &&
                        profile.yearOfExperience !== null &&
                        profile.yearOfExperience !== undefined
                      ? `${profile.yearOfExperience} year${profile.yearOfExperience === 1 ? '' : 's'}`
                      : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <Target className="h-5 w-5 mr-3 text-blue-500" />
              Learning Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {onboardingError ? (
              <p className="text-sm text-destructive" role="alert">{onboardingError}</p>
            ) : !onboardingStatus ? (
              <p className="text-sm text-muted-foreground" role="status">Loading learning goals…</p>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Institution</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {onboardingStatus.profile?.institution || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target exam or milestone</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {onboardingStatus.profile?.targetExam || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily study goal</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {onboardingStatus.profile?.dailyGoalMinutes
                      ? `${onboardingStatus.profile.dailyGoalMinutes} minutes`
                      : 'Not set'}
                  </p>
                </div>
                {(onboardingStatus.profile?.focusTopics?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority topics</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {onboardingStatus.profile?.focusTopics?.map(topic => (
                        <span
                          key={topic}
                          className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/profile/edit')}
            >
              Edit learning preferences
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <BookOpen className="h-5 w-5 mr-3 text-purple-500" />
              Recommended Learning Paths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {onboardingError ? (
              <p className="text-sm text-destructive" role="alert">{onboardingError}</p>
            ) : !onboardingStatus ? (
              <p className="text-sm text-muted-foreground" role="status">Finding paths for your profile…</p>
            ) : onboardingStatus.suggestedStarterPaths?.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {onboardingStatus.suggestedStarterPaths.map(path => (
                  <Link
                    key={path.id}
                    href={`/learning-paths/${path.id}`}
                    className="rounded-xl border border-border bg-muted/40 p-4 transition-colors hover:border-blue-500/50 hover:bg-muted/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-foreground">{path.title}</h3>
                      {path.estimatedDurationWeeks != null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {path.estimatedDurationWeeks} weeks
                        </span>
                      )}
                    </div>
                    {path.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{path.description}</p>
                    )}
                    <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400">
                      Explore path <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <p className="text-sm text-muted-foreground">
                  Complete your healthcare profile to get learning paths matched to your discipline and stage.
                </p>
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0"
                  onClick={() => router.push('/profile/edit')}
                >
                  Update profile <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
            <Link
              href="/learning-paths"
              className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Browse all learning paths <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-6 text-foreground dark:text-foreground">Account Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="hover:border-blue-500/50 transition-colors bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <Settings className="h-5 w-5 mr-2 text-muted-foreground" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-6">
              Manage your account settings, notifications, and privacy preferences.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/settings')}>Go to Settings</Button>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-500/50 transition-colors bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <Award className="h-5 w-5 mr-2 text-muted-foreground" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-6">
              View your earned achievements, badges, and milestones progress.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/profile/achievements')}>View Achievements</Button>
          </CardContent>
        </Card>

        <Card className="hover:border-green-500/50 transition-colors bg-card/80 dark:bg-card/50 backdrop-blur-sm border-border dark:border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground dark:text-foreground">
              <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-6">
              Manage your active login sessions and verify connected devices.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/profile/sessions')}>Manage Sessions</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
