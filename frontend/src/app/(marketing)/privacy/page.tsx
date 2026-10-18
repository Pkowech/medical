import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Notice | MedTrack Hub',
  description: 'How MedTrack Hub handles personal data under Kenya’s Data Protection Act, 2019.',
};

const sections = [
  {
    title: 'Personal data we handle',
    body: (
      <>
        <p>
          Depending on how you use the service, we may process account details such as your name,
          email address, username, password hash, and profile information you choose to provide. We
          also process learning records such as course enrolments, lesson progress, quiz results,
          study activity, goals, and related analytics. When Google Analytics is configured,
          marketing pages also record page and call-to-action interactions.
        </p>
        <p>
          During optional onboarding, profile information may include whether you are a student or
          professional, your healthcare field, study year or years of experience, and an optional
          specialty or area of interest. Study targets are also saved. These details support
          healthcare-learning recommendations and progress goals; they are not needed to create an
          account, and onboarding can be skipped. The service is for learning and should not be used
          to submit identifiable patient information.
        </p>
        <p>
          If you upload learning materials or connect Google Drive, we process the files or links
          and the account information needed to provide those features. Sign-in and security
          functions also process session, device, and network information. Do not submit patient
          identifiable information or other sensitive personal data unless a feature explicitly
          requires it and you are authorised to do so.
        </p>
      </>
    ),
  },
  {
    title: 'Why and on what basis we process it',
    body: (
      <>
        <p>We use personal data to:</p>
        <ul>
          <li>
            create and secure accounts, authenticate users, and provide requested learning features;
          </li>
          <li>save learning progress, quiz results, goals, and study plans;</li>
          <li>operate optional integrations such as Google sign-in and Google Drive;</li>
          <li>
            maintain service reliability, prevent abuse, and investigate security incidents; and
          </li>
          <li>respond to requests and meet applicable legal obligations.</li>
        </ul>
        <p>
          The applicable lawful basis depends on the purpose and context. It may include your
          consent, steps taken at your request, performance of the service agreement, legitimate
          interests that do not override your rights, or a legal obligation. Where processing relies
          on consent, you may withdraw it; withdrawal does not make earlier processing unlawful.
        </p>
      </>
    ),
  },
  {
    title: 'Sharing and transfers',
    body: (
      <p>
        Data may be processed by service providers that host the application, database, file
        storage, authentication, email, or optional integrations. Google processes data when you
        choose Google sign-in or Drive features, and Google Analytics may process marketing-page
        usage when it is configured. The exact provider list, access arrangements, processing
        locations, and any safeguards for transfers outside Kenya depend on the current deployment
        and must be confirmed by Medtrackhub before publication.
      </p>
    ),
  },
  {
    title: 'Retention and security',
    body: (
      <p>
        The controller must set and publish retention periods for each type of information. Data
        should be kept no longer than needed for its stated purpose or as required by law; the
        service’s exact deletion and backup schedule has not yet been confirmed. Medtrackhub must
        document the technical and organisational safeguards used in the deployed service. If a
        personal data breach occurs, notification and mitigation must follow applicable law.
      </p>
    ),
  },
  {
    title: 'Your rights and choices',
    body: (
      <>
        <p>
          Subject to the Data Protection Act and its exceptions, you may request to be informed
          about your data, access it, correct inaccurate or misleading information, request
          deletion, object to processing, or withdraw consent where consent is the basis. You may
          also complain to the Office of the Data Protection Commissioner (ODPC).
        </p>
        <p>
          To make a request, email{' '}
          <a
            className="font-medium text-blue-700 underline dark:text-blue-300"
            href="mailto:aaronrono427@gmail.com"
          >
            aaronrono427@gmail.com
          </a>{' '}
          from an address associated with your account and describe the request. We may need to
          verify your identity. Some data may need to be retained where the law permits or requires
          it.
        </p>
      </>
    ),
  },
  {
    title: 'Cookies and device storage',
    body: (
      <p>
        The service uses authentication cookies and browser storage for essential functions such as
        sign-in, preferences, offline learning, and restoring application state. The current
        deployment’s exact cookie and storage inventory should be reviewed when optional analytics
        or third-party services change. When configured, Google Analytics may use cookies or other
        identifiers for marketing-page measurement; the controller must confirm the lawful basis and
        any required consent controls before enabling it. See our{' '}
        <a className="font-medium text-blue-700 underline dark:text-blue-300" href="/cookie-policy">
          Cookie and device storage notice
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Data protection
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground sm:text-4xl">
          Privacy notice
        </h1>
      </header>

      <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <strong>Controller publication check:</strong> This notice describes the application’s
        observed data uses. Medtrackhub must confirm its full legal identity and address, ODPC
        registration status, retention schedule, provider list, processing locations, and transfer
        safeguards before relying on this notice as its final compliance disclosure.
      </div>

      <section
        className="mb-10 rounded-xl border border-border bg-card p-5 sm:p-6"
        aria-labelledby="controller-heading"
      >
        <h2
          id="controller-heading"
          className="text-lg font-semibold text-foreground dark:text-foreground"
        >
          Who is responsible
        </h2>
        <p className="mt-2 leading-7 text-muted-foreground">
          The data controller is <strong>Medtrackhub</strong>. For privacy requests or questions,
          contact{' '}
          <a
            className="font-medium text-blue-700 underline dark:text-blue-300"
            href="mailto:aaronrono427@gmail.com"
          >
            aaronrono427@gmail.com
          </a>
          .
        </p>
      </section>

      <div className="space-y-8">
        {sections.map(section => (
          <section
            key={section.title}
            aria-labelledby={section.title.toLowerCase().replaceAll(' ', '-')}
          >
            <h2
              id={section.title.toLowerCase().replaceAll(' ', '-')}
              className="mb-3 text-xl font-semibold text-foreground dark:text-foreground"
            >
              {section.title}
            </h2>
            <div className="space-y-3 leading-7 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
              {section.body}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 border-t border-border pt-8" aria-labelledby="law-heading">
        <h2 id="law-heading" className="text-xl font-semibold text-foreground dark:text-foreground">
          Applicable framework and complaints
        </h2>
        <p className="mt-3 leading-7 text-muted-foreground">
          This notice is intended to explain processing in line with Kenya’s Data Protection Act,
          2019. If you are not satisfied with our response, you may contact the{' '}
          <a
            className="font-medium text-blue-700 underline dark:text-blue-300"
            href="https://www.odpc.go.ke/"
            target="_blank"
            rel="noreferrer"
          >
            Office of the Data Protection Commissioner
          </a>
          .
        </p>
      </section>
    </main>
  );
}
