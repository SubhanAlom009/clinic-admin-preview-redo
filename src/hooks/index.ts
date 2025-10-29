/**
 * Hooks Index
 * Centralizes all hook exports for cleaner imports
 */

// Authentication
export { useAuth } from "./useAuth";

// Dashboard and Metrics
export { useDashboardMetrics } from "./useDashboardMetrics";
export { useRecentActivity } from "./useRecentActivity";

// Queue Management
export { useLiveQueue } from "./useLiveQueue";

// Re-export commonly used types if any hooks export them
// This allows for: import { useAuth, SomeType } from '../hooks'
