import React from "react";
import { Input, InputProps } from "./Input";
import { AlertCircle } from "lucide-react";

export interface ValidatedInputProps extends InputProps {
  validationError?: string;
  showError?: boolean;
  errorIcon?: boolean;
}

/**
 * Enhanced Input component with validation error display
 * Extends the existing Input component with validation features
 */
export function ValidatedInput({ 
  validationError, 
  showError = true, 
  errorIcon = true,
  className = "",
  ...props 
}: ValidatedInputProps) {
  const hasError = Boolean(validationError && showError);
  
  return (
    <div className="w-full">
      <div className="relative">
        <Input
          {...props}
          error={validationError}
        />
        {hasError && errorIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          {errorIcon && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {validationError}
        </p>
      )}
    </div>
  );
}

/**
 * Enhanced Select component with validation error display
 */
import { Select, SelectProps } from "./Select";

export interface ValidatedSelectProps extends SelectProps {
  validationError?: string;
  showError?: boolean;
  errorIcon?: boolean;
}

export function ValidatedSelect({ 
  validationError, 
  showError = true, 
  errorIcon = true,
  className = "",
  ...props 
}: ValidatedSelectProps) {
  const hasError = Boolean(validationError && showError);
  
  return (
    <div className="w-full">
      <div className="relative">
        <Select
          {...props}
          error={validationError}
        />
        {hasError && errorIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          {errorIcon && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {validationError}
        </p>
      )}
    </div>
  );
}

/**
 * Enhanced Textarea component with validation error display
 */
import { Textarea } from "./textarea";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export interface ValidatedTextareaProps extends TextareaProps {
  validationError?: string;
  showError?: boolean;
  errorIcon?: boolean;
}

export function ValidatedTextarea({ 
  validationError, 
  showError = true, 
  errorIcon = true,
  label,
  required,
  className = "",
  ...props 
}: ValidatedTextareaProps) {
  const hasError = Boolean(validationError && showError);
  
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <Textarea
          {...props}
          className={`${className} ${hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        />
        {hasError && errorIcon && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {hasError && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          {errorIcon && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
          {validationError}
        </p>
      )}
    </div>
  );
}

/**
 * Form field wrapper with label and validation error
 */
export interface FormFieldProps {
  label: string;
  required?: boolean;
  validationError?: string;
  showError?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ 
  label, 
  required = false, 
  validationError, 
  showError = true,
  children,
  className = ""
}: FormFieldProps) {
  const hasError = Boolean(validationError && showError);
  
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hasError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {validationError}
        </p>
      )}
    </div>
  );
}

/**
 * Error summary component to display all form errors at once
 */
export interface ErrorSummaryProps {
  errors: Record<string, string>;
  title?: string;
  className?: string;
}

export function ErrorSummary({ 
  errors, 
  title = "Please fix the following errors:",
  className = ""
}: ErrorSummaryProps) {
  const errorEntries = Object.entries(errors);
  
  if (errorEntries.length === 0) {
    return null;
  }
  
  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {title}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <span className="font-medium capitalize">{field.replace(/_/g, ' ')}:</span> {message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
