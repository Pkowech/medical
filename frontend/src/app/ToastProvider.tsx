'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';
import {
  Toast as RadixToast,
  ToastClose,
  ToastDescription,
  ToastProvider as RadixToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/shared/components/ui/toast';
import { useToast } from '@/shared/components/ui/use-toast';

export function ToastProvider() {
  const [mounted, setMounted] = useState(false);
  const { toasts } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Toaster position="top-right" />
      <SonnerToaster position="top-right" />
      <RadixToastProvider swipeDirection="right">
        {toasts.map(({ id, title, description, action, ...props }) => (
          <RadixToast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </RadixToast>
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </>
  );
}
