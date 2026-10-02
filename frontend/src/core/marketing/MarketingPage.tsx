'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, BarChart3 } from 'lucide-react';
import { features } from './data/features';
import { FeatureCard } from './cards/FeatureCard';
import { StickyCta } from './StickyCta';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { courseService } from '@/features/courses/services/courseService';
import { Course } from '@/shared/types/courseInterface';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export default function MarketingPage() {
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [courseCatalogLoaded, setCourseCatalogLoaded] = useState(false);

  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.initialize(GA_MEASUREMENT_ID);
    }

    const fetchCourses = async () => {
      try {
        const coursesData = await courseService.getCourses({ limit: 1 });
        setTotalCourses(coursesData.total);
        const featured = await courseService.getFeaturedCourses(3);
        setFeaturedCourses(featured);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setCourseCatalogLoaded(true);
      }
    };

    fetchCourses();
  }, []);

  const trackCTA = (buttonName: string) => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.event({
        category: 'CTA',
        action: 'Click',
        label: buttonName,
      });
    }
  };

  return (
    <div>
      <main className="min-h-screen overflow-x-clip bg-white pb-24 md:pb-0">
        {/* Hero Section */}
        <motion.section
          aria-labelledby="hero-heading"
          className="relative isolate overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -bottom-48 left-1/4 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
          </div>
          <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-20">
              <div className="min-w-0 lg:col-span-7">
                <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100 sm:text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  Medical learning, organized around you
                </p>
                <h1
                  id="hero-heading"
                  className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-[3.6rem] xl:text-6xl"
                >
                  Make your next study session count.
                  <span
                    className="mt-2 block text-blue-200"
                  >
                    Learn with a clearer plan.
                  </span>
                </h1>
                <p className="mb-7 mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:mb-8 sm:mt-6 sm:text-lg sm:leading-8">
                  Find medical courses, practice with quizzes and flashcards, plan your study time,
                  and see your progress—all in one place.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href="/register"
                    onClick={() => trackCTA('Hero Create Account')}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-base font-bold text-blue-900 shadow-lg shadow-blue-950/20 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900"
                  >
                    Create your account
                    <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
                  </Link>
                  <Link
                    href="#featured-courses"
                    onClick={() => trackCTA('Hero Browse Courses')}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/50 bg-white/5 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Browse courses
                  </Link>
                </div>
                <p className="mt-4 text-sm text-blue-200">
                  Explore available courses and learning tools.
                </p>
              </div>
              <div className="min-w-0 lg:col-span-5">
                <div className="rounded-2xl border border-white/15 bg-white p-5 text-slate-900 shadow-2xl shadow-blue-950/30 sm:p-7">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-blue-700">Your learning workspace</p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Build momentum, one step at a time</h2>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <BookOpen className="h-6 w-6" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    <Link href="/courses" className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <BookOpen className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900">Explore courses</span>
                        <span className="block text-sm text-slate-600">
                          {courseCatalogLoaded && totalCourses > 0
                            ? `${totalCourses} courses in the catalog`
                            : 'Find a topic to study'}
                        </span>
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                          <Brain className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">Practice</span>
                          <span className="block text-sm text-slate-600">Quizzes & flashcards</span>
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <BarChart3 className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">See your progress</span>
                          <span className="block text-sm text-slate-600">Goals & activity</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </motion.section>

        <section aria-label="How MedTrack Hub supports learning" className="border-b border-slate-100 bg-white">
          <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 divide-y divide-slate-100 px-4 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            {[
              { icon: BookOpen, title: 'Find a course', description: 'Browse the available catalog' },
              { icon: Brain, title: 'Practice actively', description: 'Use quizzes and flashcards' },
              { icon: BarChart3, title: 'Stay on track', description: 'Plan and review progress' },
            ].map(item => (
              <div key={item.title} className="flex items-center gap-3 px-2 py-4 sm:justify-center sm:px-4 sm:py-5">
                <item.icon className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <span className="hidden sm:inline"> · {item.description}</span>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <motion.section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-20 bg-slate-50 py-12 sm:py-16 lg:py-20"
        >
          <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider text-blue-700">A more focused way to study</p>
              <h2 id="features-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                The tools you need to keep learning moving
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Bring courses, practice, study planning, and progress into one practical workspace.
              </p>
              <Link href="/register" onClick={() => trackCTA('Features Create Account')} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {features.map(feature => (
                <motion.div
                  key={feature.title}
                  className="min-w-0"
                >
                  <FeatureCard
                    icon={<feature.icon className="h-6 w-6 text-blue-700" aria-hidden="true" />}
                    title={feature.title}
                    description={feature.description}
                    details={feature.details}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Featured Courses Section */}
        <motion.section
          id="featured-courses"
          aria-labelledby="featured-courses-heading"
          className="scroll-mt-20 bg-white py-12 sm:py-16 lg:py-20"
        >
          <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-2 text-sm font-bold uppercase tracking-wider text-blue-700">Start exploring</p>
                <h2 id="featured-courses-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Find your next topic
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
                  Browse courses currently available in the catalog.
                </p>
              </div>
              <Link href="/courses" className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-blue-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:self-auto">
                View all courses <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {featuredCourses.length === 0 && !courseCatalogLoaded ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))
              ) : featuredCourses.length > 0 ? (
                featuredCourses.map(course => (
                  <motion.div
                    key={course.id}
                    className="min-w-0"
                  >
                    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg sm:p-6">
                      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <BookOpen className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950 sm:text-xl">{course.title}</h3>
                      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-600 sm:text-base">{course.description}</p>
                      <Link href={`/courses/${course.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 self-start font-semibold text-blue-800 hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                          Explore course <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </article>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center sm:col-span-2 xl:col-span-3 sm:p-8">
                  <p className="text-base text-slate-700">
                    {courseCatalogLoaded
                      ? 'Featured courses are unavailable right now. Browse the course catalog for current availability.'
                      : 'No featured courses are available yet.'}
                  </p>
                  <Link href="/courses" className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                    Browse all courses <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          aria-labelledby="cta-heading"
          className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 py-12 text-white sm:py-16 lg:py-20"
        >
          <div className="mx-auto w-full max-w-screen-2xl px-4 text-center sm:px-6 lg:px-8">
            <h2 id="cta-heading" className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to make your next study session count?
            </h2>
            <p className="mx-auto mb-7 mt-4 max-w-2xl text-base leading-7 text-blue-100 sm:mb-8 sm:mt-5 sm:text-lg">
              Create an account to explore courses, practice tools, and learning progress in one place.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                onClick={() => trackCTA('Bottom CTA Create Account')}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 font-bold text-blue-900 shadow-lg transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900"
              >
                Create your account
                <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
              </Link>
              <Link
                href="#features"
                onClick={() => trackCTA('Bottom CTA Learn More')}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/50 bg-white/5 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Learn More
              </Link>
            </div>
          </div>
        </motion.section>
      </main>
      <StickyCta />
    </div>
  );
}
