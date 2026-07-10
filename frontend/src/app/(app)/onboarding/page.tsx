'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import { userService } from '@/features/profile/services/userService';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const years = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
  { label: '5th Year', value: 5 },
  { label: 'Graduate', value: 6 },
];

const specialties = [
  'General Medicine',
  'Surgery',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Psychiatry',
  'Internal Medicine',
  'Emergency Medicine',
  'Other',
];

const preferencesList = ['Visual', 'Reading/Writing', 'Practice/Hands-on', 'Group Study', 'Solo Study'];

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
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    year: '',
    specialty: '',
    preference: '',
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
      setProfile(p => ({
        ...p,
        name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        specialty: user.specialization || '',
        year: user.yearOfExperience ? years.find(y => y.value === user.yearOfExperience)?.label || '' : '',
      }));
    }
  }, [user]);

  const handleSkip = () => {
    toast.info('You can complete your profile later in settings.');
    router.push('/dashboard');
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Save everything and mark onboarding as complete
      const updatedPreferences = {
        ...(user.preferences || {}),
        studyTargets: {
          daily: parseInt(goals.daily, 10),
          weekly: parseInt(goals.weekly, 10),
        },
        learningPreference: profile.preference,
        onboardingCompleted: true,
      };

      const yearVal = years.find(y => y.label === profile.year)?.value;

      await userService.updateUserProfile(user.id, {
        specialization: profile.specialty,
        yearOfExperience: yearVal,
        preferences: updatedPreferences as any,
      });

      // Update local store
      updateUser({
        ...user,
        specialization: profile.specialty,
        yearOfExperience: yearVal,
        preferences: updatedPreferences as any,
      });

      toast.success('Profile setup completed successfully!', {
        duration: 3000,
      });

      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

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
            We&apos;re excited to help you master medicine. Let&apos;s personalize your experience to get the most out of your learning journey.
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
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-left">Academic Profile</h2>
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
              <label htmlFor="year-of-study" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Year of Study</label>
              <select
                id="year-of-study"
                title="Year of Study"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={profile.year}
                onChange={e => setProfile(p => ({ ...p, year: e.target.value }))}
                required
              >
                <option value="">Select current year</option>
                {years.map(y => (
                  <option key={y.value} value={y.label}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="specialty" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Specialty Interest
              </label>
              <select
                id="specialty"
                title="Specialty Interest"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={profile.specialty}
                onChange={e => setProfile(p => ({ ...p, specialty: e.target.value }))}
                required
              >
                <option value="">Select specialty</option>
                {specialties.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Study Preference
              </label>
              <div className="grid grid-cols-2 gap-2">
                {preferencesList.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfile(prev => ({ ...prev, preference: p }))}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      profile.preference === p
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 font-medium'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex flex-col space-y-3">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all"
              >
                Continue
              </Button>
              <Button variant="ghost" className="text-slate-400" onClick={handleSkip}>
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
                <Button variant="outline" className="flex-1 rounded-xl py-6" onClick={prevStep}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-6"
                >
                  Continue
                </Button>
              </div>
              <Button variant="ghost" className="text-slate-400" onClick={handleSkip}>
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
