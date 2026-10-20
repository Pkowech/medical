'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/features/auth/store/useAuthStore';
import {
  onboardingService,
  StarterPathItem,
  OnboardingStatusResponse,
} from '@/features/onboarding/services/onboardingService';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  Target,
  Sparkles,
  School,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { healthcareFields, healthcareFieldLabel } from '@/shared/utils/healthcareProfile';

const tourSlides = [
  {
    title: 'Your Dashboard',
    description:
      'Track your progress, set goals, and access all your discipline-specific learning tools from one place.',
    icon: '📊',
  },
  {
    title: 'Rapid Review & Practicals',
    description:
      'Quickly reinforce weak areas with high-yield clinical quizzes, drug cards, and case studies tailored to your year.',
    icon: '⚡',
  },
  {
    title: 'Study Groups & Cohort Peers',
    description:
      'Collaborate and benchmark against peers in your exact discipline, year, and course tracks.',
    icon: '👥',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    careerStage: '' as 'student' | 'professional' | '',
    healthcareField: '',
    otherHealthcareField: '',
    studyYear: '',
    yearsExperience: '',
    specialty: '',
    institution: '',
    targetExam: '',
  });
  const [goals, setGoals] = useState({
    daily: '45',
    weekly: '315',
  });
  const [loading, setLoading] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [completedStatus, setCompletedStatus] = useState<OnboardingStatusResponse | null>(null);

  useEffect(() => {
    if (user) {
      const knownField = healthcareFields.find(
        field =>
          field.value === user.healthcareField ||
          field.label.toLowerCase() === user.healthcareField?.toLowerCase(),
      );
      const userPrefs = (user.preferences as Record<string, any>) || {};

      setProfile(p => ({
        ...p,
        name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        careerStage: (user.careerStage as 'student' | 'professional') || '',
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
        institution: userPrefs.institution || '',
        targetExam: userPrefs.targetExam || '',
      }));
    }
  }, [user]);

  const handleSkip = () => {
    toast.info('You can update your healthcare profile anytime from Profile Settings.');
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
    const healthcareField =
      profile.healthcareField === 'other'
        ? profile.otherHealthcareField.trim()
        : profile.healthcareField;
    const studyYear =
      careerStage === 'student' && profile.studyYear
        ? Number(profile.studyYear)
        : undefined;
    const yearsExperience =
      careerStage === 'professional' && profile.yearsExperience
        ? Number(profile.yearsExperience)
        : undefined;

    setLoading(true);
    try {
      const result = await onboardingService.complete({
        healthcareField,
        careerStage,
        studyYear,
        yearOfExperience: yearsExperience,
        specialization: profile.specialty.trim() || undefined,
        institution: profile.institution.trim() || undefined,
        targetExam: profile.targetExam.trim() || undefined,
        dailyGoalMinutes: parseInt(goals.daily, 10),
      });

      setCompletedStatus(result);

      // Update local auth store
      setUser({
        ...user,
        careerStage,
        healthcareField,
        studyYear: studyYear ?? null,
        yearOfExperience: yearsExperience ?? null,
        specialization: profile.specialty.trim() || null,
        preferences: {
          ...(user.preferences || {}),
          institution: profile.institution.trim() || undefined,
          targetExam: profile.targetExam.trim() || undefined,
          dailyGoalMinutes: parseInt(goals.daily, 10),
          onboardingCompleted: true,
        },
      });

      if (session?.user) {
        await updateSession({
          user: {
            ...session.user,
            careerStage,
            healthcareField,
            studyYear: studyYear ?? null,
            yearOfExperience: yearsExperience ?? null,
            specialization: profile.specialty.trim() || null,
          },
        });
      }

      toast.success('Profile setup completed successfully!', { duration: 3000 });
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

  if (!user && step > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border p-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-foreground text-center">Welcome to MedTrack Hub!</h1>
          <p className="text-muted-foreground mb-6 text-center leading-relaxed">
            Personalize your clinical and academic journey. Tell us your healthcare discipline and level to calibrate your courses, peer comparisons, and recommendations.
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
              className="w-full text-muted-foreground"
              onClick={handleSkip}
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Discipline & Program Level
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border p-8 flex flex-col">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-foreground">Discipline & Program</h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 1 of 3</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-1/3 transition-all" />
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              nextStep();
            }}
          >
            <div>
              <label htmlFor="healthcare-field" className="block text-sm font-semibold text-foreground mb-1.5">
                Healthcare Discipline
              </label>
              <select
                id="healthcare-field"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={profile.healthcareField}
                onChange={e => setProfile(p => ({ ...p, healthcareField: e.target.value }))}
                required
              >
                <option value="">Select your discipline</option>
                {healthcareFields.map(field => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>

            {profile.healthcareField === 'other' && (
              <div>
                <label htmlFor="other-healthcare-field" className="block text-sm font-semibold text-foreground mb-1.5">
                  Specify Your Discipline
                </label>
                <input
                  id="other-healthcare-field"
                  type="text"
                  maxLength={80}
                  value={profile.otherHealthcareField}
                  onChange={e => setProfile(p => ({ ...p, otherHealthcareField: e.target.value }))}
                  required
                  placeholder="e.g. Clinical Nutrition, Optometry"
                  className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="career-stage" className="block text-sm font-semibold text-foreground mb-1.5">
                  Current Stage
                </label>
                <select
                  id="career-stage"
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={profile.careerStage}
                  onChange={e =>
                    setProfile(p => ({
                      ...p,
                      careerStage: e.target.value as 'student' | 'professional' | '',
                    }))
                  }
                  required
                >
                  <option value="">Select stage</option>
                  <option value="student">Student / Trainee</option>
                  <option value="professional">Practicing Professional</option>
                </select>
              </div>

              {profile.careerStage === 'student' ? (
                <div>
                  <label htmlFor="study-year" className="block text-sm font-semibold text-foreground mb-1.5">
                    Year of Study
                  </label>
                  <select
                    id="study-year"
                    value={profile.studyYear}
                    onChange={e => setProfile(p => ({ ...p, studyYear: e.target.value }))}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Select year</option>
                    {[1, 2, 3, 4, 5, 6].map(y => (
                      <option key={y} value={y}>Year {y} (Level {y})</option>
                    ))}
                  </select>
                </div>
              ) : profile.careerStage === 'professional' ? (
                <div>
                  <label htmlFor="years-experience" className="block text-sm font-semibold text-foreground mb-1.5">
                    Experience (Years)
                  </label>
                  <input
                    id="years-experience"
                    type="number"
                    min="0"
                    max="60"
                    value={profile.yearsExperience}
                    onChange={e => setProfile(p => ({ ...p, yearsExperience: e.target.value }))}
                    required
                    placeholder="e.g. 3"
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="institution" className="block text-sm font-semibold text-foreground mb-1.5">
                Institution / School / Hospital (optional)
              </label>
              <div className="relative">
                <School className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="institution"
                  type="text"
                  maxLength={120}
                  value={profile.institution}
                  onChange={e => setProfile(p => ({ ...p, institution: e.target.value }))}
                  placeholder="e.g. Kenyatta University, Nairobi Hospital"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="specialty" className="block text-sm font-semibold text-foreground mb-1.5">
                Specialization / Sub-Track (optional)
              </label>
              <input
                id="specialty"
                type="text"
                maxLength={120}
                value={profile.specialty}
                onChange={e => setProfile(p => ({ ...p, specialty: e.target.value }))}
                placeholder="e.g. Clinical Pharmacy, Paediatrics, Pharmacotherapy"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="pt-3 flex flex-col space-y-2">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-all"
              >
                Continue to Goals
              </Button>
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Milestone & Study Habits
  if (step === 2) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border p-8 flex flex-col">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold text-foreground">Milestones & Commitment</h2>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 2 of 3</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-2/3 transition-all" />
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
              <label htmlFor="target-exam" className="block text-sm font-semibold text-foreground mb-1.5">
                Target Exam, Board, or Primary Milestone (optional)
              </label>
              <div className="relative">
                <Target className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="target-exam"
                  type="text"
                  maxLength={120}
                  value={profile.targetExam}
                  onChange={e => setProfile(p => ({ ...p, targetExam: e.target.value }))}
                  placeholder="e.g. Pharmacy Board Stage II, NCLEX-RN, USMLE Step 1, Final Year CATs"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                We will anchor your starter goals and deadlines around this milestone.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="daily-target" className="text-sm font-semibold text-foreground">
                  Daily Study Goal
                </label>
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">{goals.daily} mins / day</span>
              </div>
              <input
                id="daily-target"
                type="range"
                min="15"
                max="240"
                step="15"
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                value={goals.daily}
                onChange={e => {
                  const val = e.target.value;
                  setGoals({ daily: val, weekly: (parseInt(val, 10) * 7).toString() });
                }}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>15m (Light)</span>
                <span>45m (Balanced)</span>
                <span>90m (Intensive)</span>
                <span>3h+ (Board Prep)</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col space-y-3">
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1 rounded-xl py-5" onClick={prevStep}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-5"
                >
                  Continue to Tour
                </Button>
              </div>
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Quick Platform Tour & Completion
  if (step === 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg bg-card rounded-2xl shadow-xl border border-border p-10 flex flex-col items-center">
          <div className="mb-4">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Step 3 of 3</span>
          </div>

          <div className="w-full text-center mb-8">
            <div className="text-5xl mb-4">{tourSlides[tourIndex].icon}</div>
            <h2 className="text-2xl font-bold text-foreground mb-3">{tourSlides[tourIndex].title}</h2>
            <p className="text-muted-foreground leading-relaxed min-h-[4rem]">
              {tourSlides[tourIndex].description}
            </p>
          </div>

          <div className="w-full flex justify-center space-x-2 mb-8">
            {tourSlides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === tourIndex ? 'w-8 bg-blue-600' : 'w-2 bg-secondary'
                }`}
              />
            ))}
          </div>

          <div className="w-full space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl py-5"
                disabled={tourIndex === 0}
                onClick={() => setTourIndex(i => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-5 w-5 mr-1" /> Previous
              </Button>

              {tourIndex < tourSlides.length - 1 ? (
                <Button
                  className="flex-[2] bg-blue-600 hover:bg-blue-700 rounded-xl py-5"
                  onClick={() => setTourIndex(i => i + 1)}
                >
                  Next <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              ) : (
                <Button
                  className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl py-5 shadow-lg shadow-green-600/20"
                  onClick={handleFinish}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Complete Setup
                </Button>
              )}
            </div>
            {tourIndex === 0 && (
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={prevStep}>
                Back to Goals
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: High-Value Confirmation with Matched Starter Pathways!
  if (finished) {
    const fieldLabel = healthcareFieldLabel(profile.healthcareField);
    const starterPaths: StarterPathItem[] = completedStatus?.suggestedStarterPaths || [];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl border border-border p-8 md:p-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-5">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-2 text-foreground">You&apos;re All Set for {fieldLabel}!</h2>
          <p className="text-muted-foreground mb-6 max-w-lg leading-relaxed">
            Your profile is calibrated for {profile.careerStage === 'student' ? `Year ${profile.studyYear}` : 'Professional Practice'} {profile.specialty ? `in ${profile.specialty}` : ''}. We have seeded your starter goal and matched your curriculum.
          </p>

          {/* Calibrated Badge Strip */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {fieldLabel}
            </span>
            {profile.studyYear && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                Level {profile.studyYear}
              </span>
            )}
            {profile.targetExam && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                <Target className="w-3 h-3" /> {profile.targetExam}
              </span>
            )}
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-3 h-3" /> Starter Goal Active
            </span>
          </div>

          {/* Matched Starter Pathways Cards */}
          {starterPaths.length > 0 && (
            <div className="w-full text-left space-y-3 mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" /> Your Matched Curricula
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {starterPaths.slice(0, 4).map(path => {
                  const pathTypeBadge =
                    path.pathType === 'CLINICAL_COMPETENCY'
                      ? { label: 'Clinical Clerkship', cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' }
                      : path.pathType === 'EXAM_BLUEPRINT'
                      ? { label: 'Exam Blueprint', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' }
                      : { label: 'Study Path', cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
                  return (
                    <div
                      key={path.id}
                      onClick={() => router.push(`/learning-paths/${path.id}`)}
                      className="p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted/80 hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${pathTypeBadge.cls}`}>
                            {pathTypeBadge.label}
                          </span>
                          {path.estimatedDurationWeeks && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {path.estimatedDurationWeeks}w
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">{path.title}</h4>
                        {path.category?.name && (
                          <span className="text-[10px] text-muted-foreground/80 italic">{path.category.name}</span>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{path.description}</p>
                      </div>
                      <div className="mt-3 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                        Explore Curriculum <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl transition-all shadow-xl shadow-blue-500/20 text-base"
            onClick={() => router.push('/dashboard')}
          >
            Go to Your Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
