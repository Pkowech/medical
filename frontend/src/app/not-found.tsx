import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <h2 className="mt-2 text-2xl font-semibold text-gray-700">Page Not Found</h2>
          <p className="mt-2 text-gray-600">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard">
            <Button className="bg-blue-600 hover:bg-blue-700">Return Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
