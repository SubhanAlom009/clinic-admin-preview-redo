import { useState, useCallback } from "react";
import { z } from "zod";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface UseFormValidationReturn<T> {
  errors: Record<string, string>;
  isValid: boolean;
  validate: (data: Partial<T>) => ValidationResult;
  validateField: (fieldName: string, value: any) => boolean;
  clearErrors: () => void;
  clearFieldError: (fieldName: string) => void;
  setErrors: (errors: Record<string, string>) => void;
}

/**
 * Reusable hook for form validation using Zod schemas
 * @param schema - Zod schema for validation
 * @returns Validation utilities and state
 */
export function useFormValidation<T>(schema: z.ZodSchema<T>): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);

  // Validate entire form data
  const validate = useCallback((data: Partial<T>): ValidationResult => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      setErrors({});
      setIsValid(true);
      return { isValid: true, errors: {} };
    } else {
      const newErrors: Record<string, string> = {};
      
      result.error.issues.forEach(issue => {
        if (issue.path.length > 0) {
          const fieldName = issue.path[0].toString();
          newErrors[fieldName] = issue.message;
        }
      });
      
      setErrors(newErrors);
      setIsValid(false);
      return { isValid: false, errors: newErrors };
    }
  }, [schema]);

  // Validate individual field
  const validateField = useCallback((fieldName: string, value: any): boolean => {
    try {
      // Create a partial schema for just this field
      const partialData = { [fieldName]: value };
      const result = schema.safeParse(partialData);
      
      if (!result.success) {
        // Find the error for this specific field
        const fieldError = result.error.issues.find(issue => 
          issue.path.length > 0 && issue.path[0] === fieldName
        );
        
        if (fieldError) {
          setErrors(prev => ({ ...prev, [fieldName]: fieldError.message }));
          setIsValid(false);
          return false;
        }
      }
      
      // Clear field error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      
      // Check if form is now valid (no remaining errors)
      const hasOtherErrors = Object.keys(errors).some(key => key !== fieldName);
      setIsValid(!hasOtherErrors);
      return true;
    } catch (error) {
      console.warn(`Validation error for field ${fieldName}:`, error);
      return true; // Fail gracefully
    }
  }, [schema, errors]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setIsValid(false);
  }, []);

  // Clear specific field error
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  // Set errors manually (useful for server-side errors)
  const setErrorsManually = useCallback((newErrors: Record<string, string>) => {
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  }, []);

  return {
    errors,
    isValid,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    setErrors: setErrorsManually,
  };
}

/**
 * Hook for real-time field validation (validates on blur)
 * @param schema - Zod schema for validation
 * @param validateOnChange - Whether to validate on every change (default: false)
 * @returns Validation utilities with real-time validation
 */
export function useRealtimeValidation<T>(
  schema: z.ZodSchema<T>,
  validateOnChange: boolean = false
) {
  const validation = useFormValidation(schema);

  const handleFieldBlur = useCallback((fieldName: string, value: any) => {
    validation.validateField(fieldName, value);
  }, [validation]);

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    if (validateOnChange) {
      validation.validateField(fieldName, value);
    } else {
      // Clear error when user starts typing (if there was an error)
      if (validation.errors[fieldName]) {
        validation.clearFieldError(fieldName);
      }
    }
  }, [validation, validateOnChange]);

  return {
    ...validation,
    handleFieldBlur,
    handleFieldChange,
  };
}

/**
 * Hook for form submission with validation
 * @param schema - Zod schema for validation
 * @param onSubmit - Submit handler function
 * @returns Form submission utilities
 */
export function useFormSubmission<T>(
  schema: z.ZodSchema<T>,
  onSubmit: (data: T) => Promise<void> | void
) {
  const validation = useFormValidation(schema);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (formData: Partial<T>) => {
    // Validate form data
    const result = validation.validate(formData);
    
    if (!result.isValid) {
      return { success: false, errors: result.errors };
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData as T);
      validation.clearErrors();
      return { success: true, errors: {} };
    } catch (error) {
      console.error("Form submission error:", error);
      return { 
        success: false, 
        errors: { 
          submit: error instanceof Error ? error.message : "An error occurred" 
        } 
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [validation, onSubmit]);

  return {
    ...validation,
    isSubmitting,
    handleSubmit,
  };
}
