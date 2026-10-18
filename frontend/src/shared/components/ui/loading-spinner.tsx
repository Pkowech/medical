import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'white';
  fullScreen?: boolean;
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  fullScreen = false,
  className = '',
  message,
}) => {
  const sizeClasses: Record<string, string> = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16',
  };

  const colorClasses: Record<string, string> = {
    primary: 'border-t-blue-600',
    secondary: 'border-t-gray-600',
    white: 'border-t-white',
  };

  const spinner = (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} border-4 border-border dark:border-border ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {message ? <p className="ml-3 text-muted-foreground dark:text-muted-foreground">{message}</p> : null}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-card/80 dark:bg-card/80 backdrop-blur-sm z-50">
        <div className="text-center">
          <div className="mb-4">{spinner}</div>
          <p className="text-muted-foreground dark:text-muted-foreground font-medium">{message ?? 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return spinner;
};
