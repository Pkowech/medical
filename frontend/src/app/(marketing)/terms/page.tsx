import type { Metadata } from 'next';
import { getPageMetadata } from '@/core/metadata/pageMetadata';

export const metadata: Metadata = getPageMetadata('/terms');

const terms = [
  {
    title: 'Using the service',
    content:
      'MedTrack Hub provides online tools for medical learning, including courses, assessments, flashcards, study planning, progress tracking, and optional file integrations. Some features require an account. You are responsible for keeping your sign-in credentials secure and for activity under your account.',
  },
  {
    title: 'Acceptable use',
    content:
      'Use the service lawfully and respectfully. Do not attempt to access another person’s account or data, interfere with service security or availability, upload malicious code, or use the platform to infringe another person’s rights. You must have the rights and permissions needed to upload, share, or connect any content you provide.',
  },
  {
    title: 'Learning and medical disclaimer',
    content:
      'Content is provided for education and study support only. It is not medical advice, diagnosis, treatment, or a substitute for professional judgement, clinical supervision, current guidelines, or local protocols. Do not rely on the service to make decisions about a patient’s care.',
  },
  {
    title: 'Your content and service materials',
    content:
      'You retain rights you hold in content you submit. You permit Medtrackhub to host and process that content only as needed to provide, secure, and maintain the features you use. Medtrackhub and its licensors retain rights in the platform and its original materials. Do not copy or redistribute materials unless you have permission or the law allows it.',
  },
  {
    title: 'Availability and changes',
    content:
      'Features, content, and integrations may change or be unavailable from time to time. We will take reasonable steps to protect stored learning data, but you should keep copies of important materials you are entitled to retain. We may restrict or suspend access where necessary to protect users, the service, or legal obligations.',
  },
  {
    title: 'Privacy',
    content:
      'Our Privacy Notice explains how personal data is handled under Kenya’s Data Protection Act, 2019. By creating an account, you acknowledge that you have had the opportunity to read that notice. Where processing requires consent, consent is requested separately and may be withdrawn.',
  },
  {
    title: 'Questions',
    content:
      'For questions about these terms, email aaronrono427@gmail.com. These terms and the service are being prepared for users in Kenya; the controller should obtain legal review of governing-law, dispute, liability, and consumer-protection provisions before treating this page as a final binding agreement.',
  },
];

export default function TermsPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          MedTrack Hub
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground sm:text-4xl">
          Terms of use
        </h1>
      </header>

      <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        These terms are a plain-language service description and require legal review before
        publication as a final agreement, particularly for operator identity, liability, governing
        law, and dispute procedures.
      </div>

      <div className="space-y-8">
        {terms.map((term, index) => (
          <section key={term.title} aria-labelledby={`terms-${index}`}>
            <h2
              id={`terms-${index}`}
              className="mb-3 text-xl font-semibold text-foreground dark:text-foreground"
            >
              {term.title}
            </h2>
            <p className="leading-7 text-muted-foreground">{term.content}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
