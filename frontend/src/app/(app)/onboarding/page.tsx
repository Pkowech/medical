'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { userService } from '@/features/profile/services/userService';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { healthcareFields } from '@/shared/utils/healthcareProfile';

const tourSlides = [
  {
    title: 'Your Dashboard',
    description:
      'Track your progress, set goals, and access all your learning tools from one place.',
    icon: '📊',
  },
  {
    title: 'Rapid Review',
    description:
      'Quickly reinforce weak areas with high-yield, fast-paced quizzes tailored to you.',
    icon: '⚡',
  },
  {
    title: 'Study Groups',
    description: 'Join or create groups to collaborate, compete, and learn together with peers.',
    icon: '👥',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    careerStage: '' as 'student' | 'professional' | '',
    healthcareField: '',
    otherHealthcareField: '',
    studyYear: '',
    yearsExperience: '',
    specialty: '',
  });
  const [goals, setGoals] = useState({
    daily: '30',
    weekly: '210',
  });
  const [loading, setLoading] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (user) {
      const knownField = healthcareFields.find(
        field =>
          field.value === user.healthcareField ||
          field.label.toLowerCase() === user.healthcareField?.toLowerCase(),
      );
      setProfile(p => ({
        ...p,
        name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        careerStage: user.careerStage || '',
        healthcareField: user.healthcareField
          ? knownField ? knownField.value : 'other'
          : '',
        otherHealthcareField: user.healthcareField && !knownField
          ? user.healthcareField
          : '',
        studyYear: user.studyYear ? String(user.studyYear) : '',
        yearsExperience:
          user.yearOfExperience !== null && user.yearOfExperience !== undefined
            ? String(user.yearOfExperience)
            : '',
        specialty: user.specialization || '',
      }));
    }
  }, [user]);

  const handleSkip = () => {
    toast.info('You can finish your healthcare profile later from Profile > Edit Profile.');
    router.push('/dashboard');
  };

  const handleFinish = async () => {
    if (!user) return;
    if (
      !profile.careerStage ||
      !profile.healthcareField ||
      (profile.healthcareField === 'other' && !profile.otherHealthcareField.trim())
    ) {
      setStep(1);
      toast.error('Complete your healthcare path details before finishing setup.');
      return;
    }
    const careerStage = profile.careerStage;
    setLoading(true);
    try {
      // Save everything and mark onboarding as complete
      const updatedPreferences = {
        ...(user.preferences || {}),
        studyTargets: {
          daily: parseInt(goals.daily, 10),
          weekly: parseInt(goals.weekly, 10),
        },
        onboardingCompleted: true,
      };

      const healthcareField =
        profile.healthcareField === 'other'
          ? profile.otherHealthcareField.trim()
          : profile.healthcareField;
      const studyYear =
        careerStage === 'student' && profile.studyYear
          ? Number(profile.studyYear)
          : null;
      const yearsExperience =
        careerStage === 'professional' && profile.yearsExperience
          ? Number(profile.yearsExperience)
          : null;

      await userService.updateUserProfile(user.id, {
        careerStage,
        healthcareField,
        studyYear,
        yearOfExperience: yearsExperience,
        specialization: profile.specialty.trim() || null,
        preferences: updatedPreferences,
      });

      // Update local store
      updateUser({
        ...user,
        careerStage,
        healthcareField,
        studyYear,
        yearOfExperience: yearsExperience,
        specialization: profile.specialty.trim() || null,
        preferences: updatedPreferences,
      });
      if (session?.user) {
        await updateSession({
          user: {
            ...session.user,
            careerStage,
            healthcareField,
            studyYear,
            yearOfExperience: yearsExperience,
            specialization: profile.specialty.trim() || null,
          },
        });
      }

      toast.success('Profile setup completed successfully!', {
        duration: 3000,
      });

      setFinished(true);
      setStep(4);

    } catch (err) {
      console.error('[Onboarding] Error saving data:', err);
      toast.error('Failed to save your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  // Loading state if user not yet available
  if (!user && step > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
        <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white text-center">Welcome to MedTrack Hub!</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 text-center leading-relaxed">
            We&apos;re excited to support your healthcare learning and career. Let&apos;s personalize your experience.
          </p>
          <div className="w-full space-y-3">
            <Button
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl transition-all shadow-lg shadow-blue-500/20"
              onClick={nextStep}
            >
              Start Personalization
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              onClick={handleSkip}
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Profile Setup
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-left">Your Healthcare Path</h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 1 of 3</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-1/3 transition-all"></div>
            </div>
          </div>

          <form
            className="space-y-5"
            onSubmit={e => {
              e.preventDefault();
              nextStep();
            }}
          >
            <div>
              <label htmlFor="full-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
              <input
                id="full-name"
                type="text"
                disabled
                title="Full Name (read-only)"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-500 cursor-not-allowed"
                value={profile.name}
              />
              <p className="text-xs text-slate-400 mt-1">Name can be changed in settings.</p>
            </div>

            <div>
              <label htmlFor="career-stage" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Current stage</label>
              <select
                id="career-stage"
                title="Current stage"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={profile.careerStage}
                onChange={e =>
                  setProfile(p => ({
                    ...p,
                    careerStage: e.target.value as 'student' | 'professional' | '',
                  }))
                }
                required
              >
                <option value="">Select your current stage</option>
                <option value="student">Student or trainee</option>
                <option value="professional">Qualified healthcare professional</option>
              </select>
            </div>

            <div>
              <label htmlFor="healthcare-field" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Healthcare field
              </label>
              <select
                id="healthcare-field"
                title="Healthcare field"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={profile.healthcareField}
                onChange={e => setProfile(p => ({ ...p, healthcareField: e.target.value }))}
                required
              >
                <option value="">Select your field</option>
                {healthcareFields.map(field => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>

            {profile.healthcareField === 'other' && (
              <div>
                <label htmlFor="other-healthcare-field" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Your healthcare field
                </label>
                <input
                  id="other-healthcare-field"
                  type="text"
                  maxLength={80}
                  value={profile.otherHealthcareField}
                  onChange={e => setProfile(p => ({ ...p, otherHealthcareField: e.target.value }))}
                  required
                  placeholder="Enter your field"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            )}

            {profile.careerStage === 'student' && (
              <div>
                <label htmlFor="study-year" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Current year of study
                </label>
                <select
                  id="study-year"
                  value={profile.studyYear}
                  onChange={e => setProfile(p => ({ ...p, studyYear: e.target.value }))}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Select year</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(year => (
                    <option key={year} value={year}>Year {year}</option>
                  ))}
                </select>
              </div>
            )}

            {profile.careerStage === 'professional' && (
              <div>
                <label htmlFor="years-experience" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Years of professional experience
                </label>
                <input
                  id="years-experience"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  value={profile.yearsExperience}
                  onChange={e => setProfile(p => ({ ...p, yearsExperience: e.target.value }))}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            )}

            <div>
              <label htmlFor="specialty" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Specialty or area of interest (optional)
              </label>
              <input
                id="specialty"
                type="text"
                maxLength={120}
                value={profile.specialty}
                onChange={e => setProfile(p => ({ ...p, specialty: e.target.value }))}
                placeholder="e.g. Cardiology, oncology pharmacy"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="pt-4 flex flex-col space-y-3">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all"
              >
                Continue
              </Button>
              <Button type="button" variant="ghost" className="text-slate-400" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Learning Goals
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-left">Study Goals</h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 2 of 3</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-2/3 transition-all"></div>
            </div>
          </div>

          <form
            className="space-y-6"
            onSubmit={e => {
              e.preventDefault();
              nextStep();
            }}
          >
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Setting daily targets helps maintain your streak and improves retention.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="daily-target" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Daily Target (mins)</label>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{goals.daily}m</span>
              </div>
              <input
                id="daily-target"
                type="range"
                title="Daily Study Target"
                min="15"
                max="300"
                step="15"
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                value={goals.daily}
                onChange={e => setGoals(g => {
                  const val = e.target.value;
                  return { ...g, daily: val, weekly: (parseInt(val, 10) * 7).toString() };
                })}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="weekly-target" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Weekly Target (mins)</label>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{goals.weekly}m</span>
              </div>
              <input
                id="weekly-target"
                type="range"
                title="Weekly Study Target"
                min="60"
                max="2100"
                step="60"
                className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                value={goals.weekly}
                onChange={e => setGoals(g => ({ ...g, weekly: e.target.value }))}
              />
            </div>

            <div className="pt-6 flex flex-col space-y-3">
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 rounded-xl py-6" onClick={prevStep}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-6"
                >
                  Continue
                </Button>
              </div>
              <Button type="button" variant="ghost" className="text-slate-400" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Quick Tour
  if (step === 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 flex flex-col items-center">
          <div className="mb-4">
             <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 3 of 3</span>
          </div>
          
          <div className="w-full text-center mb-10">
            <div className="text-5xl mb-6">{tourSlides[tourIndex].icon}</div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{tourSlides[tourIndex].title}</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed min-h-[4rem]">
              {tourSlides[tourIndex].description}
            </p>
          </div>

          <div className="w-full flex justify-center space-x-2 mb-10">
            {tourSlides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === tourIndex ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="w-full space-y-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl py-6"
                disabled={tourIndex === 0}
                onClick={() => setTourIndex(i => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-5 w-5 mr-1" /> Previous
              </Button>
              
              {tourIndex < tourSlides.length - 1 ? (
                <Button 
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 rounded-xl py-6" 
                  onClick={() => setTourIndex(i => i + 1)}
                >
                  Next <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              ) : (
                <Button
                  className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-6"
                  onClick={handleFinish}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Complete Setup
                </Button>
              )}
            </div>
            {tourIndex === 0 && (
              <Button variant="ghost" className="w-full text-slate-400" onClick={prevStep}>
                Back to Goals
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Confirmation
  if (finished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
        <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white text-center text-pretty">You&apos;re All Set!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10 text-center leading-relaxed">
            Your profile and goals have been personalized. Explore your dashboard and start your learning journey today!
          </p>
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-7 rounded-2xl transition-all shadow-xl shadow-blue-500/20 text-lg"
            onClick={() => router.push('/dashboard')}
          >
            Start Learning
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
