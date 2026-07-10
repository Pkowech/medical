'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorService } from '@/app/services/error.service';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorService.handleApiError({
      message: error.message,
      status: 0,
      code: 'UI_ERROR',
      details: { errorInfo },
      timestamp: new Date().toISOString(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong.</h2>
          <p className="text-sm text-gray-600 mt-2">Please try again or refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
