import { ReactNode, FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthFormProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  submitText: string;
  footer?: ReactNode;
}

export function AuthForm({
  title,
  subtitle,
  children,
  onSubmit,
  isLoading = false,
  submitText,
  footer,
}: AuthFormProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
      </div>

      <form method="post" onSubmit={onSubmit} className="space-y-4">
        {children}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:focus:ring-offset-gray-800`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            submitText
          )}
        </button>
      </form>

      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );
}
