'use client';

import Link from 'next/link';

const securityTips = [
  'Enable multi-factor authentication for all privileged accounts.',
  'Rotate application passwords every 90 days and use a password manager.',
  'Review recent login activity to catch suspicious sessions quickly.',
];

export default function SecurityPage() {
  return (
    <section className="flex flex-col gap-8 py-10">
      <header className="space-y-3 text-center">
        <p className="text-sm uppercase tracking-wide text-blue-600">Security Center</p>
        <h1 className="text-3xl font-semibold text-gray-900">Keep your account protected</h1>
        <p className="text-gray-600">
          Review the recommendations below to make sure your MedTrackHub account stays secure.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Security health</h2>
          <p className="mt-2 text-sm text-gray-500">
            Set up MFA and review trusted devices for best protection.
          </p>
          <Link
            href="/settings/security"
            className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Go to security settings →
          </Link>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Active sessions</h2>
          <p className="mt-2 text-sm text-gray-500">
            View and revoke devices that currently have access to your account.
          </p>
          <Link
            href="/profile/sessions"
            className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage sessions →
          </Link>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
          <p className="mt-2 text-sm text-gray-500">
            Check login attempts, password changes, and other sensitive actions.
          </p>
          <Link
            href="/admin/audit-logs"
            className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Review audit logs →
          </Link>
        </article>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
        <h2 className="text-lg font-semibold text-blue-900">Quick recommendations</h2>
        <ul className="mt-4 space-y-2 text-sm text-blue-900">
          {securityTips.map(tip => (
            <li key={tip} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
