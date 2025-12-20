-- Auto No-Show Detection Migration
-- This creates a pg_cron job that runs every 5 minutes to mark
-- past appointments as "no-show" if they're still "scheduled"
-- Grace period: 30 minutes after scheduled time

-- ============================================================================
-- STEP 1: Create a function to mark no-shows
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_noshow_appointments()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Mark appointments as no-show if:
  -- 1. Status is 'scheduled' (not checked-in, in-progress, etc.)
  -- 2. Appointment time + 30 min grace period has passed
  UPDATE appointments
  SET 
    status = 'no-show',
    updated_at = NOW()
  WHERE 
    status = 'scheduled'
    AND appointment_datetime + INTERVAL '30 minutes' < NOW();
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log the result (optional - helps with debugging)
  IF affected_count > 0 THEN
    RAISE NOTICE '[AUTO-NOSHOW] Marked % appointments as no-show at %', affected_count, NOW();
  END IF;
  
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_noshow_appointments TO authenticated;
GRANT EXECUTE ON FUNCTION mark_noshow_appointments TO service_role;

-- Add helpful comment
COMMENT ON FUNCTION mark_noshow_appointments IS 
  'Automatically marks scheduled appointments as no-show if they are 30+ minutes past their scheduled time. Called by pg_cron every 5 minutes.';

-- ============================================================================
-- STEP 2: Schedule the cron job (runs every 5 minutes)
-- NOTE: pg_cron must be enabled in your Supabase dashboard first!
-- Dashboard > Database > Extensions > Enable pg_cron
-- ============================================================================

-- First, try to unschedule if it already exists (to make this migration idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-mark-noshow');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

-- Schedule the job to run every 5 minutes
SELECT cron.schedule(
  'auto-mark-noshow',                    -- Job name
  '*/5 * * * *',                         -- Every 5 minutes
  'SELECT mark_noshow_appointments();'   -- Function to call
);

-- ============================================================================
-- VERIFICATION: Check that the job was created
-- ============================================================================
-- You can verify by running: SELECT * FROM cron.job WHERE jobname = 'auto-mark-noshow';

-- ============================================================================
-- TO DISABLE: Run this if you want to stop the auto no-show feature
-- ============================================================================
-- SELECT cron.unschedule('auto-mark-noshow');
