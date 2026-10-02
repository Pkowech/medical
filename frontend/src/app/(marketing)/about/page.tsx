import { Button } from '@/shared/components/ui/button';
import Link from 'next/link';
import Head from 'next/head';
import { features } from '@/core/marketing/data/features';
import { FeatureCard } from '@/core/marketing/cards/FeatureCard';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About MedTrack Hub - Our Mission and Vision</title>
        <meta
          name="description"
          content="Learn about MedTrack Hub and its tools for medical courses, practice, study planning, and progress tracking."
        />
        <meta property="og:title" content="About MedTrack Hub - Our Mission and Vision" />
        <meta
          property="og:description"
          content="Learn about MedTrack Hub and its tools for medical courses, practice, study planning, and progress tracking."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Head>
      <main className="container mx-auto py-12 px-4">
        {/* Hero Section */}
        <section aria-labelledby="about-hero-heading" className="mb-14 text-center sm:mb-20">
          <h1 id="about-hero-heading" className="mb-6 text-3xl font-bold sm:text-4xl md:text-5xl">
            Medical learning, organized
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-base text-muted-foreground sm:text-lg">
            MedTrack Hub brings available courses, quizzes, flashcards, study planning, and progress
            tracking together for medical learners.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex justify-center">
              <Button size="lg" className="px-8">
                Create an account
              </Button>
            </Link>
            <Link href="/features" className="inline-flex justify-center">
              <Button variant="outline" size="lg" className="px-8">
                Explore features
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section aria-labelledby="about-features-heading" className="mb-14 sm:mb-20">
          <h2 id="about-features-heading" className="mb-8 text-center text-2xl font-bold sm:mb-12 sm:text-3xl">
            Learning tools in one place
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map(feature => (
              <FeatureCard
                key={feature.title}
                icon={<feature.icon className="h-10 w-10 text-primary mb-4" aria-hidden="true" />}
                title={feature.title}
                description={feature.description}
                details={[]}
              />
            ))}
          </div>
        </section>

        {/* Mission Statement */}
        <section aria-labelledby="mission-heading" className="mb-14 text-center sm:mb-20">
          <div className="max-w-3xl mx-auto">
            <h2 id="mission-heading" className="text-3xl font-bold mb-6">
              Our Mission
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              To revolutionize medical education by providing accessible, personalized, and
              effective learning tools that empower the next generation of healthcare professionals.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section
          aria-labelledby="about-cta-heading"
          className="rounded-2xl bg-muted p-6 text-center sm:p-10 lg:p-12"
        >
          <h2 id="about-cta-heading" className="text-3xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Explore the courses and learning tools currently available.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-8">
              Create an account
            </Button>
          </Link>
        </section>
      </main>
    </>
  );
}
