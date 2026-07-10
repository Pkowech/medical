"use client";

import * as React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog';
import { Button } from './button';

export const AlertDialog = Dialog;
export const AlertDialogTrigger = DialogTrigger;
export const AlertDialogContent = DialogContent;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;

// Cancel just closes the dialog
export const AlertDialogCancel: React.FC<React.ComponentProps<typeof Button>> = ({ children, ...props }) => (
  <DialogClose asChild>
    <Button variant="outline" {...props}>
      {children}
    </Button>
  </DialogClose>
);

// Action typically performs an action and closes the dialog
export const AlertDialogAction: React.FC<React.ComponentProps<typeof Button>> = ({ children, ...props }) => (
  <DialogClose asChild>
    <Button {...props}>{children}</Button>
  </DialogClose>
);

export type AlertDialogProps = React.ComponentProps<typeof Dialog>;

export default AlertDialog;
