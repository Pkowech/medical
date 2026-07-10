import { Button } from '@/shared/components/ui/button';
import Link from 'next/link';
import Head from 'next/head';
import { stats } from '@/core/marketing/data/stats';
import { features } from '@/core/marketing/data/features';
import { FeatureCard } from '@/core/marketing/cards/FeatureCard';

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About MedTrack Hub - Our Mission and Vision</title>
        <meta
          name="description"
          content="Learn about MedTrack Hub's mission to transform medical education with AI-powered learning, expert-led content, and a supportive community."
        />
        <meta property="og:title" content="About MedTrack Hub - Our Mission and Vision" />
        <meta
          property="og:description"
          content="Learn about MedTrack Hub's mission to transform medical education with AI-powered learning, expert-led content, and a supportive community."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://medtrackhub.com/about" />
        <meta property="og:image" content="https://medtrackhub.com/og-image.png" />
      </Head>
      <main className="container mx-auto py-12 px-4">
        {/* Hero Section */}
        <section aria-labelledby="about-hero-heading" className="text-center mb-20">
          <h1 id="about-hero-heading" className="text-4xl md:text-6xl font-bold mb-6">
            Transforming Medical Education
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            MedTrack Hub combines cutting-edge technology with expert medical knowledge to create a
            revolutionary learning experience for future healthcare professionals.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/register">
              <Button size="lg" className="px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section aria-labelledby="about-features-heading" className="mb-20">
          <h2 id="about-features-heading" className="text-3xl font-bold text-center mb-12">
            Why Choose MedTrack Hub?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
        <section aria-labelledby="mission-heading" className="mb-20 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 id="mission-heading" className="text-3xl font-bold mb-6">
              Our Mission
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              To revolutionize medical education by providing accessible, personalized, and
              effective learning tools that empower the next generation of healthcare professionals.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <h3 className="text-4xl font-bold text-primary mb-2">{stats.activeStudents}</h3>
                <p className="text-muted-foreground">Active Students</p>
              </div>
              <div>
                <h3 className="text-4xl font-bold text-primary mb-2">200+</h3>
                <p className="text-muted-foreground">Expert Contributors</p>
              </div>
              <div>
                <h3 className="text-4xl font-bold text-primary mb-2">{stats.satisfactionRate}</h3>
                <p className="text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          aria-labelledby="about-cta-heading"
          className="text-center bg-muted rounded-lg p-12"
        >
          <h2 id="about-cta-heading" className="text-3xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of medical students already using MedTrack Hub to achieve their
            educational goals.
          </p>
          <Link href="/auth/register">
            <Button size="lg" className="px-8">
              Start Your Journey
            </Button>
          </Link>
        </section>
      </main>
    </>
  );
}
