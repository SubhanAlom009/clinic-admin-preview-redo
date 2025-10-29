/**
 * Base Service Class
 * Provides common functionality for all services
 */
import { supabase } from "../lib/supabase";
import { ERROR_MESSAGES } from "../constants";

export class BaseService {
  protected static handleError(error: unknown): Error {
    console.error("Service Error:", error);

    const errorObj = error as { message?: string; code?: string };

    if (errorObj.message?.includes("network")) {
      return new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }

    if (
      errorObj.message?.includes("unauthorized") ||
      errorObj.code === "PGRST301"
    ) {
      return new Error(ERROR_MESSAGES.UNAUTHORIZED);
    }

    return new Error(errorObj.message || "An unexpected error occurred");
  }

  protected static validateRequired(fields: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(fields)) {
      if (value === null || value === undefined || value === "") {
        throw new Error(`${key} is required`);
      }
    }
  }

  protected static async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw this.handleError(error);
    if (!user) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
    return user;
  }
}

export type ServiceResponse<T> = {
  data?: T;
  error?: Error;
  success: boolean;
};
