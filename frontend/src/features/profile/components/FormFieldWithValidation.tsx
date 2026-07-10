'use client';

import React from 'react';

interface FormFieldWithValidationProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  errors?: string[];
  helpText?: string;
  isValid?: boolean;
  isTextarea?: boolean;
  rows?: number;
  maxLength?: number;
}

export function FormFieldWithValidation({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  errors,
  helpText,
  isValid,
  isTextarea = false,
  rows = 3,
  maxLength,
}: FormFieldWithValidationProps) {
  const hasErrors = errors && errors.length > 0;
  const showValid = isValid === true && !hasErrors && value.trim().length > 0;

  const inputClassName = `
    w-full px-3 py-2 rounded-lg text-sm transition-colors
    bg-gray-50 dark:bg-slate-900/50
    border
    ${hasErrors
      ? 'border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500'
      : showValid
        ? 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500 focus:border-emerald-500'
        : 'border-gray-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
    }
    text-gray-900 dark:text-slate-200
    placeholder:text-gray-400 dark:placeholder:text-slate-600
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim();

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 dark:text-slate-300"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {isTextarea ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={inputClassName}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          className={inputClassName}
        />
      )}

      {maxLength && isTextarea && (
        <p className="text-xs text-gray-400 dark:text-slate-600 text-right">
          {value.length}/{maxLength}
        </p>
      )}

      {hasErrors && (
        <div className="space-y-0.5">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400">
              {err}
            </p>
          ))}
        </div>
      )}

      {helpText && !hasErrors && (
        <p className="text-xs text-gray-400 dark:text-slate-500">{helpText}</p>
      )}
    </div>
  );
}
