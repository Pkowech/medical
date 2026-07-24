import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { pricingTiers } from '@/core/marketing/data/pricing';
import { Check } from 'lucide-react';
import Head from 'next/head';

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>MedTrack Hub - Flexible Pricing Plans</title>
        <meta
          name="description"
          content="Choose the perfect MedTrack Hub plan for your medical education journey. Transparent pricing for students, professionals, and institutions."
        />
        <meta property="og:title" content="MedTrack Hub - Flexible Pricing Plans" />
        <meta
          property="og:description"
          content="Choose the perfect MedTrack Hub plan for your medical education journey. Transparent pricing for students, professionals, and institutions."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Head>
      <main className="container mx-auto py-12 px-4">
        <section aria-labelledby="pricing-heading" className="text-center mb-12">
          <h1 id="pricing-heading" className="text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose the plan that's right for your medical education journey
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map(tier => (
            <Card key={tier.name} className={'flex flex-col border-border'}>
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.price !== 'Custom' && (
                    <span className="text-muted-foreground">{tier.priceSuffix}</span>
                  )}
                </div>
                <ul className="space-y-3">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-center">
                      <Check className="h-5 w-5 text-primary mr-2" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className={'w-full bg-secondary'}>{tier.cta}</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <section aria-labelledby="custom-solution-heading" className="mt-16 text-center">
          <h2 id="custom-solution-heading" className="text-2xl font-bold mb-4">
            Need a Custom Solution?
          </h2>
          <p className="text-muted-foreground mb-6">
            We offer customized plans for institutions and special requirements. Contact our sales
            team to learn more.
          </p>
          <Button variant="outline" size="lg">
            Contact Sales
          </Button>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 bg-muted rounded-lg p-8">
          <div className="text-center mb-8">
            <h2 id="faq-heading" className="text-2xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground">Have questions? We've got answers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h3 className="font-bold mb-2">Can I switch plans later?</h3>
              <p className="text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected
                in your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Yes, all plans come with a 14-day free trial. No credit card required.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, PayPal, and bank transfers for institutional
                plans.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Do you offer student discounts?</h3>
              <p className="text-muted-foreground">
                Yes, we offer special discounts for verified students. Contact our support team with
                your student ID.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
