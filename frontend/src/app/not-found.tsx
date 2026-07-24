import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50 dark:bg-slate-900">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404 - Page Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">The page you are looking for does not exist.</p>
      <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
        Return to Dashboard
      </Link>
    </div>
  );
}
