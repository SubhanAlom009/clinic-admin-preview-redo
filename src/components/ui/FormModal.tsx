/**
 * Reusable Form Modal Component
 * Reduces boilerplate for all form modals in the application
 */
import React, { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertCircle, Loader2 } from "lucide-react";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  submitText?: string;
  cancelText?: string;
  submitVariant?: "primary" | "secondary" | "danger" | "outline";
  isLoading?: boolean;
  error?: string;
  // allow one larger modal for complex forms
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  showCancelButton?: boolean;
  submitDisabled?: boolean;
}

export function FormModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  onSubmit,
  submitText = "Save",
  cancelText = "Cancel",
  submitVariant = "primary",
  isLoading = false,
  error,
  maxWidth = "md",
  showCancelButton = true,
  submitDisabled = false,
}: FormModalProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submitDisabled) return;
    await onSubmit(e);
  };

  const modalSizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={`w-full mx-auto ${modalSizeClasses[maxWidth]}`}>
        <div className="px-6 py-4">
          {description && (
            <p className="text-sm text-gray-600 mb-4">{description}</p>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-6">{children}</div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              {showCancelButton && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  {cancelText}
                </Button>
              )}
              <Button
                type="submit"
                variant={submitVariant}
                disabled={isLoading || submitDisabled}
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  submitText
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Confirmation Modal Component
 * For delete/destructive actions
 */
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmationModalProps) {
  const handleConfirm = async () => {
    if (isLoading) return;
    await onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="max-w-sm mx-auto">
        <div className="mb-6">
          <div className="flex items-start">
            <AlertCircle className="h-6 w-6 text-red-500 mt-1 mr-3 flex-shrink-0" />
            <p className="text-sm text-gray-700">{message}</p>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
