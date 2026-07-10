/**
 * Validation schemas and utilities
 * Centralized validation logic using Zod
 */

import { z } from 'zod';
import { VALIDATION } from './constants';

// Base schemas
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(
    VALIDATION.EMAIL.MAX_LENGTH,
    `Email must be less than ${VALIDATION.EMAIL.MAX_LENGTH} characters`
  );

export const passwordSchema = z
  .string()
  .min(
    VALIDATION.PASSWORD.MIN_LENGTH,
    `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`
  )
  .max(
    VALIDATION.PASSWORD.MAX_LENGTH,
    `Password must be less than ${VALIDATION.PASSWORD.MAX_LENGTH} characters`
  )
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const usernameSchema = z
  .string()
  .min(
    VALIDATION.USERNAME.MIN_LENGTH,
    `Username must be at least ${VALIDATION.USERNAME.MIN_LENGTH} characters`
  )
  .max(
    VALIDATION.USERNAME.MAX_LENGTH,
    `Username must be less than ${VALIDATION.USERNAME.MAX_LENGTH} characters`
  )
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  );

// Authentication schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z
      .string()
      .min(1, 'First name is required')
      .max(50, 'First name must be less than 50 characters'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .max(50, 'Last name must be less than 50 characters'),
    username: usernameSchema,
    acceptTerms: z
      .boolean()
      .refine(val => val === true, 'You must accept the terms and conditions'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Profile schemas
export const profileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  username: usernameSchema,
  email: emailSchema,
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

// Course schemas
export const courseSchema = z.object({
  title: z
    .string()
    .min(1, 'Course title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .min(1, 'Course description is required')
    .max(1000, 'Description must be less than 1000 characters'),
  category: z.string().min(1, 'Category is required'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
  isPublic: z.boolean(),
});

// Material schemas
export const materialSchema = z.object({
  title: z
    .string()
    .min(1, 'Material title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  type: z.enum(['document', 'video', 'audio', 'image', 'link']),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
  isPublic: z.boolean(),
});

// Quiz schemas
export const quizQuestionSchema = z.object({
  question: z
    .string()
    .min(1, 'Question is required')
    .max(500, 'Question must be less than 500 characters'),
  type: z.enum(['multiple-choice', 'true-false', 'short-answer', 'essay']),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  explanation: z.string().max(1000, 'Explanation must be less than 1000 characters').optional(),
  points: z.number().min(1, 'Points must be at least 1'),
});

export const quizSchema = z.object({
  title: z
    .string()
    .min(1, 'Quiz title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  timeLimit: z.number().min(1, 'Time limit must be at least 1 minute').optional(),
  questions: z.array(quizQuestionSchema).min(1, 'At least one question is required'),
  passingScore: z.number().min(0).max(100, 'Passing score must be between 0 and 100'),
  allowRetakes: z.boolean(),
  shuffleQuestions: z.boolean(),
});

// Search schemas
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query must be less than 100 characters'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['relevance', 'date', 'title', 'rating']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().min(1, 'Page must be at least 1'),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100'),
});

// File upload schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type CourseFormData = z.infer<typeof courseSchema>;
export type MaterialFormData = z.infer<typeof materialSchema>;
export type QuizFormData = z.infer<typeof quizSchema>;
export type QuizQuestionFormData = z.infer<typeof quizQuestionSchema>;
export type SearchFormData = z.infer<typeof searchSchema>;
export type PaginationData = z.infer<typeof paginationSchema>;
export type FileUploadFormData = z.infer<typeof fileUploadSchema>;
