import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  helperText?: string;
  showPasswordToggle?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, showPasswordToggle = false, className = '', ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const errorId = `${props.id || props.name}-error`;
    const helperId = `${props.id || props.name}-helper`;
    const describedBy = [
      props['aria-describedby'],
      error ? errorId : undefined,
      helperText && !error ? helperId : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
    const isPasswordField = showPasswordToggle && props.type === 'password';

    return (
      <div className="space-y-1">
        <label
          htmlFor={props.id || props.name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>

        <div className="relative">
          <input
            ref={ref}
            className={`
              w-full px-3 py-2 border rounded-lg shadow-sm placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-500
              ${
                error
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }
              ${isPasswordField ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
            type={isPasswordField && isPasswordVisible ? 'text' : props.type}
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={describedBy}
          />
          {isPasswordField && (
            <button
              type="button"
              onClick={() => setIsPasswordVisible(visible => !visible)}
              onMouseDown={event => event.preventDefault()}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={isPasswordVisible}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isPasswordVisible ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {error && (
          <div
            id={errorId}
            role="alert"
            className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
