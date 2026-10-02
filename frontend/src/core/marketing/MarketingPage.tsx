'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, BarChart3, RefreshCw } from 'lucide-react';
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
      <main className="min-h-screen bg-white">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          aria-labelledby="hero-heading"
          className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-indigo-700/20 backdrop-blur-sm"></div>
          <div className="w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-8">
                <h1
                  id="hero-heading"
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
                >
                  Build your medical knowledge with{' '}
                  <span
                    className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200 mt-2"
                    aria-live="polite"
                  >
                    focused learning tools
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-blue-100 mb-8 leading-relaxed max-w-2xl">
                  Explore medical courses, practice with quizzes and flashcards, plan your study,
                  and track learning progress in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register"
                    onClick={() => trackCTA('Hero Create Account')}
                    className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    Create an Account
                    <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/features"
                    onClick={() => trackCTA('Hero Explore Features')}
                    className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all transform hover:scale-105 backdrop-blur-sm"
                  >
                    Explore Features
                  </Link>
                </div>
              </div>
              <div className="relative mt-8 lg:mt-0">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
                      <BookOpen
                        className="h-6 w-6 sm:h-8 sm:w-8 text-blue-200 mb-2"
                        aria-hidden="true"
                      />
                      <h3 className="text-base sm:text-lg font-semibold mb-1">
                        {courseCatalogLoaded
                          ? totalCourses > 0
                            ? totalCourses
                            : 'Browse'
                          : '...'}
                      </h3>
                      <p className="text-sm sm:text-base text-blue-100">Available courses</p>
                    </div>
                    <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
                      <Brain
                        className="h-6 w-6 sm:h-8 sm:w-8 text-blue-200 mb-2"
                        aria-hidden="true"
                      />
                      <h3 className="text-base sm:text-lg font-semibold mb-1">Practice</h3>
                      <p className="text-sm sm:text-base text-blue-100">Quizzes and flashcards</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg">
                      <BarChart3 className="h-8 w-8 text-blue-200 mb-2" aria-hidden="true" />
                      <h3 className="text-lg font-semibold mb-1">Track</h3>
                      <p className="text-sm sm:text-base text-blue-100">Progress and study goals</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg">
                      <RefreshCw className="h-8 w-8 text-blue-200 mb-2" aria-hidden="true" />
                      <h3 className="text-lg font-semibold mb-1">Sync later</h3>
                      <p className="text-sm sm:text-base text-blue-100">Queue supported updates offline</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          id="features"
          aria-labelledby="features-heading"
          className="py-20 bg-gray-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-3xl font-bold text-gray-900 mb-4">
                Learning tools available today
              </h2>
              <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
                Explore the learning, practice, progress, and study-planning tools currently available in MedTrack Hub.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  viewport={{ once: true, amount: 0.3 }}
                >
                  <FeatureCard
                    icon={<feature.icon className="h-8 w-8 text-blue-600" aria-hidden="true" />}
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          id="featured-courses"
          aria-labelledby="featured-courses-heading"
          className="py-20 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="featured-courses-heading" className="text-3xl font-bold text-gray-900 mb-4">
                Featured Courses
              </h2>
              <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
                Browse courses currently available in the catalog. Course coverage varies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredCourses.length === 0 && !courseCatalogLoaded ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg shadow-lg overflow-hidden p-6 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))
              ) : featuredCourses.length > 0 ? (
                featuredCourses.map((course, index) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <div className="bg-gray-50 rounded-lg shadow-lg overflow-hidden">
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                        <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                        <Link href={`/courses/${course.id}`} className="text-blue-600 font-semibold hover:underline">
                          Learn More <ArrowRight className="inline h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
                  <p className="text-base text-gray-700">
                    {courseCatalogLoaded
                      ? 'Featured courses are unavailable right now. Browse the course catalog for current availability.'
                      : 'No featured courses are available yet.'}
                  </p>
                  <Link href="/courses" className="mt-3 inline-flex items-center font-semibold text-blue-700 hover:underline">
                    Browse courses <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          aria-labelledby="cta-heading"
          className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 id="cta-heading" className="text-4xl font-bold mb-6">
              Ready to Transform Your Medical Education?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Create an account to explore the course catalog, learning tools, and progress
              features currently available in MedTrack Hub.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                onClick={() => trackCTA('Bottom CTA Create Account')}
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
              >
                Create an Account
                <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />
              </Link>
              <Link
                href="#features"
                onClick={() => trackCTA('Bottom CTA Learn More')}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-all transform hover:scale-105 backdrop-blur-sm"
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
