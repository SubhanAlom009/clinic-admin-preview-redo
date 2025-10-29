-- Option 1: Complete PGMQ Setup
-- This adds the missing trigger to automatically enqueue PGMQ jobs when appointments change

-- Trigger function to enqueue PGMQ recalculation jobs
CREATE OR REPLACE FUNCTION trigger_enqueue_recalc_job()
RETURNS TRIGGER AS $$
DECLARE
  target_doctor_id UUID;
  target_service_day DATE;
BEGIN
  -- Determine which doctor/date to recalculate
  IF TG_OP = 'DELETE' THEN
    target_doctor_id := OLD.clinic_doctor_id;
    target_service_day := OLD.appointment_datetime::date;
  ELSE
    target_doctor_id := NEW.clinic_doctor_id;
    target_service_day := NEW.appointment_datetime::date;
  END IF;
  
  -- Only enqueue if the change affects queue order
  IF TG_OP = 'INSERT' OR 
     TG_OP = 'DELETE' OR
     (TG_OP = 'UPDATE' AND (
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.checked_in_at IS DISTINCT FROM NEW.checked_in_at OR
       OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date OR
       OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id
     )) THEN
    
    -- Enqueue recalculation job for target doctor/date
    PERFORM enqueue_recalc_job(target_doctor_id, target_service_day);
    
    -- If doctor or date changed in UPDATE, also enqueue for old doctor/date
    IF TG_OP = 'UPDATE' AND (
      OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id OR
      OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date
    ) THEN
      PERFORM enqueue_recalc_job(OLD.clinic_doctor_id, OLD.appointment_datetime::date);
    END IF;
  END IF;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-enqueue PGMQ jobs
DROP TRIGGER IF EXISTS auto_enqueue_recalc_trigger ON appointments;
CREATE TRIGGER auto_enqueue_recalc_trigger
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_enqueue_recalc_job();

-- Function that pg_cron will call to process PGMQ jobs
CREATE OR REPLACE FUNCTION process_recalc_jobs()
RETURNS jsonb AS $$
DECLARE
  job_record RECORD;
  jobs_processed INTEGER := 0;
  jobs_failed INTEGER := 0;
  result JSONB;
BEGIN
  -- Read up to 50 jobs with 60-second visibility timeout
  FOR job_record IN 
    SELECT * FROM read_recalc_jobs(50, 60)
  LOOP
    BEGIN
      -- Extract job payload
      DECLARE
        doctor_id UUID := (job_record.message->>'clinic_doctor_id')::UUID;
        service_day DATE := (job_record.message->>'service_day')::DATE;
      BEGIN
        -- Recalculate queue positions
        WITH numbered_appointments AS (
          SELECT 
            id,
            ROW_NUMBER() OVER (
              ORDER BY 
                CASE 
                  WHEN status = 'in_progress' THEN 1
                  WHEN status = 'checked_in' THEN 2
                  WHEN status = 'scheduled' THEN 3
                  ELSE 4
                END ASC,
                checked_in_at ASC NULLS LAST,
                appointment_datetime ASC
            ) as new_position
          FROM appointments 
          WHERE clinic_doctor_id = doctor_id
            AND appointment_datetime::date = service_day
            AND status NOT IN ('cancelled', 'no_show', 'completed')
        )
        UPDATE appointments 
        SET 
          queue_position = numbered_appointments.new_position,
          updated_at = NOW()
        FROM numbered_appointments 
        WHERE appointments.id = numbered_appointments.id;
        
        -- Clear queue position for completed/cancelled appointments
        UPDATE appointments
        SET queue_position = NULL
        WHERE clinic_doctor_id = doctor_id
          AND appointment_datetime::date = service_day
          AND status IN ('cancelled', 'no_show', 'completed')
          AND queue_position IS NOT NULL;
        
        -- Acknowledge (delete) the job
        PERFORM ack_recalc_job(job_record.msg_id);
        jobs_processed := jobs_processed + 1;
      END;
    EXCEPTION WHEN OTHERS THEN
      -- Archive failed job
      PERFORM archive_recalc_job(job_record.msg_id);
      jobs_failed := jobs_failed + 1;
      RAISE WARNING 'Failed to process job %: %', job_record.msg_id, SQLERRM;
    END;
  END LOOP;
  
  -- Return summary
  RETURN jsonb_build_object(
    'jobs_processed', jobs_processed,
    'jobs_failed', jobs_failed,
    'processed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_enqueue_recalc_job TO authenticated;
GRANT EXECUTE ON FUNCTION process_recalc_jobs TO authenticated;

COMMENT ON FUNCTION trigger_enqueue_recalc_job IS 'Trigger function that enqueues PGMQ recalculation jobs when appointments change';
COMMENT ON FUNCTION process_recalc_jobs IS 'Processes PGMQ recalculation jobs (call from pg_cron every 30 seconds)';

-- NOTE: You need to set up pg_cron to call process_recalc_jobs every 30 seconds
-- Run this in Supabase SQL Editor AFTER enabling pg_cron:
-- 
-- SELECT cron.schedule(
--   'process-queue-recalc-jobs',
--   '30 seconds',
--   $$SELECT process_recalc_jobs();$$
-- );
