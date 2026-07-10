'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { ArrowRight, Users, BookOpen, Award, Globe } from 'lucide-react';
import { useMounted } from '@/shared/hooks/useMounted';
import { stats as mockStats } from './data/stats';
import { features } from './data/features';
import { pricingTiers } from './data/pricing';
import { FeatureCard } from './cards/FeatureCard';
import { TestimonialCard } from './cards/TestimonialCard';
import { PricingCard } from './cards/PricingCard';
import { StickyCta } from './StickyCta';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/shared/components/ui/accordion';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { courseService } from '@/features/courses/services/courseService';
import { Course } from '@/shared/types/courseInterface';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

const faqs = [
  {
    question: 'How does the AI-driven curriculum adapt to my performance?',
    answer:
      'Our neural engine evaluates your diagnostic accuracy and recall speed across every module. It automatically identifies knowledge gaps and adjusts your study roadmap, prioritizing high-yield concepts where you need the most reinforcement.',
  },
  {
    question: 'Is the content aligned with board exam standards (USMLE, MCAT, PLAB)?',
    answer:
      'Yes. Our curriculum is mapped directly to the latest medical board examination blueprints. High-yield content is tagged and frequently updated by our board-certified specialist panel to ensure total alignment with current standards.',
  },
  {
    question: 'Can I track my progress against global peer benchmarks?',
    answer:
      'Absolutely. Our Clinical Case Analytics section provides anonymized comparative data, allowing you to see how your diagnostic prowess and knowledge retention stacks up against thousands of medical professionals worldwide.',
  },
  {
    question: 'Is offline access supported for hospital environments with poor connectivity?',
    answer:
      'Yes, our Pro and Institutional tiers support full offline synchronization. You can download courses, case studies, and 3D models to your device, ensuring uninterrupted learning even in the most demanding clinical settings.',
  },
];

const trustedByLogos = [
  { name: 'Mayo Clinic', src: '/logo.svg' },
  { name: 'Johns Hopkins Medicine', src: '/logo.svg' },
  { name: 'Cleveland Clinic', src: '/logo.svg' },
  { name: 'Stanford Medicine', src: '/logo.svg' },
];

export default function MarketingPage() {
  const isMounted = useMounted();
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [totalCourses, setTotalCourses] = useState<number>(0);

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
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight"
                >
                  Architect Your Medical Mastery with{' '}
                  <span
                    className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200 mt-2"
                    aria-live="polite"
                  >
                    Precision AI Learning
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
                  Empower your clinical journey with our sophisticated medical ecosystem. 
                  Leveraging neural-adaptive pathways and real-time performance analytics, 
                  MedTrack Hub transforms standard curriculum into a high-precision roadmap to medical excellence.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register"
                    onClick={() => trackCTA('Hero Start Free Trial')}
                    className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    Start Free Trial
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
                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
                      <Users
                        className="h-6 w-6 sm:h-8 sm:w-8 text-blue-200 mb-2"
                        aria-hidden="true"
                      />
                      <h3 className="text-base sm:text-lg font-semibold mb-1">
                        {mockStats.activeStudents}
                      </h3>
                      <p className="text-sm sm:text-base text-blue-100">Global Scholars</p>
                    </div>
                    <div className="bg-white/10 p-3 sm:p-4 rounded-lg">
                      <BookOpen
                        className="h-6 w-6 sm:h-8 sm:w-8 text-blue-200 mb-2"
                        aria-hidden="true"
                      />
                      <h3 className="text-base sm:text-lg font-semibold mb-1">
                        {totalCourses > 0 ? totalCourses : mockStats.coursesAvailable}
                      </h3>
                      <p className="text-sm sm:text-base text-blue-100">Vetted Courses</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg">
                      <Award className="h-8 w-8 text-blue-200 mb-2" aria-hidden="true" />
                      <h3 className="text-lg font-semibold mb-1">{mockStats.satisfactionRate}</h3>
                      <p className="text-blue-100">Board Exam Pass Rate</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg">
                      <Globe className="h-8 w-8 text-blue-200 mb-2" aria-hidden="true" />
                      <h3 className="text-lg font-semibold mb-1">{(mockStats as Record<string, unknown>).partnerInstitutions as string || '120+'}</h3>
                      <p className="text-blue-100">Global Partners</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Trusted By Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          aria-labelledby="trusted-by-heading"
          className="py-16 bg-gray-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 id="trusted-by-heading" className="text-2xl font-bold text-gray-700 mb-8">
              Trusted by Leading Institutions
            </h2>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              {trustedByLogos.map(logo => (
                <motion.img
                  key={logo.name}
                  src={logo.src}
                  alt={logo.name}
                  className="h-12 transition-all duration-300"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true, amount: 0.5 }}
                />
              ))}
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
                Redefining Medical Education Standards
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Discover the sophisticated features that make MedTrack Hub the definitive choice for the modern clinician.
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
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Explore our most popular courses, designed to give you a competitive edge.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredCourses.length === 0 ? (
                // Skeleton loading state
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg shadow-lg overflow-hidden p-6 space-y-4">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))
              ) : (
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
              )}
            </div>
          </div>
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          id="testimonials"
          aria-labelledby="testimonials-heading"
          className="py-20 bg-gray-50"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="testimonials-heading" className="text-3xl font-bold text-gray-900 mb-4">
                What Our Students Say
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Join thousands of successful medical students who have transformed their careers
                with MedTrack Hub.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <TestimonialCard
                  name="Dr. Sarah Chen"
                  role="Resident Physician, Internal Medicine"
                  quote="MedTrack Hub revolutionized my study approach. The adaptive learning system helped me focus on my weak areas and improved my board scores significantly."
                  avatar="S"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <TestimonialCard
                  name="Michael Rodriguez"
                  role="Medical Student, Year 3"
                  quote="The progress tracking features are incredible. I can see exactly where I need to improve, and the AI recommendations are spot-on."
                  avatar="M"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <TestimonialCard
                  name="Dr. Ahmed Hassan"
                  role="Emergency Medicine Resident"
                  quote="As a busy resident, I love how I can study efficiently with bite-sized lessons and track my progress on the go."
                  avatar="A"
                />
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Pricing Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          id="pricing"
          aria-labelledby="pricing-heading"
          className="py-20 bg-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="pricing-heading" className="text-3xl font-bold text-gray-900 mb-4">
                Choose Your Plan
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Flexible pricing options designed to fit every student's needs and budget.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {pricingTiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  viewport={{ once: true, amount: 0.3 }}
                >
                  <PricingCard
                    name={tier.name}
                    price={tier.price}
                    priceSuffix={tier.priceSuffix}
                    description={tier.description}
                    features={tier.features}
                    cta={tier.cta}
                    highlighted={tier.name === 'Pro'}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true, amount: 0.3 }}
          id="faq"
          aria-labelledby="faq-heading"
          className="py-20 bg-gray-50"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 id="faq-heading" className="text-3xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-gray-600">
                Find answers to the most common questions about MedTrack Hub.
              </p>
            </div>
            {!isMounted ? (
              <div className="space-y-4">
                {faqs.map((_faq, index) => (
                  <div key={index} className="border-b border-gray-200 py-4">
                    <Skeleton className="h-7 w-3/4 mb-2" />
                  </div>
                ))}
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-lg font-semibold text-gray-800 hover:text-blue-600">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600 text-base leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
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
              Join thousands of medical students and professionals who are already advancing their
              careers with MedTrack Hub. Start your free trial today and experience the future of
              medical learning.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                onClick={() => trackCTA('Bottom CTA Get Started')}
                className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center justify-center shadow-lg"
              >
                Get Started for Free
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
