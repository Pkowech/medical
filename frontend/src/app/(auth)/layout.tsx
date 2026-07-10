'use client';

import { ReactNode } from 'react';
import AuthLayout from '@/features/auth/components/AuthLayout';

interface AuthLayoutWrapperProps {
  children: ReactNode;
}

export default function AuthLayoutWrapper({ children }: AuthLayoutWrapperProps) {
  return <AuthLayout>{children}</AuthLayout>;
}
