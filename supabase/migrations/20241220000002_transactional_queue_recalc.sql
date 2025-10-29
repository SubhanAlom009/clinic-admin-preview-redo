-- Transactional queue recalculation function
-- This is the single source of truth for queue position calculation

CREATE OR REPLACE FUNCTION recalculate_queue_tx(p_clinic_doctor_id uuid, p_service_day date)
RETURNS jsonb AS $$
DECLARE
  _retry int := 0;
  _max_retries int := 3;
  _start_time timestamp := now();
  _end_time timestamp;
  _rows_updated int := 0;
  _result jsonb;
  _day_start timestamp := (p_service_day::timestamp AT TIME ZONE 'UTC');
  _day_end timestamp := _day_start + interval '1 day';
BEGIN
  -- Log the start of recalculation with structured logging
  RAISE LOG 'QUEUE_RECALC_START: doctor_id=%, service_day=%, timestamp=%', 
    p_clinic_doctor_id, p_service_day, NOW();

  -- Retry loop for handling serialization failures
  WHILE _retry <= _max_retries LOOP
    BEGIN
      -- Lock and clear all queue positions for this doctor and day
      UPDATE appointments 
      SET 
        queue_position = NULL,
        estimated_start_time = NULL,
        updated_at = now()
      WHERE 
        clinic_doctor_id = p_clinic_doctor_id
        AND service_day = p_service_day;

      -- Get all active appointments for this doctor and day, ordered deterministically
      WITH active_appointments AS (
        SELECT 
          id,
          appointment_datetime,
          duration_minutes,
          emergency_status,
          ROW_NUMBER() OVER (
            ORDER BY 
              COALESCE(emergency_status, false) DESC,  -- Emergency appointments first
              appointment_datetime ASC                 -- Then by scheduled time
          ) as new_position
        FROM appointments
        WHERE 
          clinic_doctor_id = p_clinic_doctor_id
          AND service_day = p_service_day
          AND status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS')  -- Only active appointments
        ORDER BY 
          COALESCE(emergency_status, false) DESC,
          appointment_datetime ASC
      ),
      -- Calculate estimated start times based on sequential processing
      appointments_with_times AS (
        SELECT 
          id,
          new_position,
          appointment_datetime,
          duration_minutes,
          -- Calculate estimated start time (9 AM + cumulative duration of previous appointments)
          (_day_start + interval '9 hours' + 
           SUM(COALESCE(duration_minutes, 30)) OVER (
             ORDER BY new_position 
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) * interval '1 minute'
          ) as estimated_start
        FROM active_appointments
      )
      -- Update appointments with new queue positions and estimated times
      UPDATE appointments 
      SET 
        queue_position = awt.new_position,
        estimated_start_time = awt.estimated_start,
        updated_at = now()
      FROM appointments_with_times awt
      WHERE appointments.id = awt.id;

      -- Get count of updated rows
      GET DIAGNOSTICS _rows_updated = ROW_COUNT;

      -- Log the operation with structured logging
      RAISE LOG 'QUEUE_RECALC_SUCCESS: doctor_id=%, service_day=%, appointments_updated=%, processing_time_ms=%', 
        p_clinic_doctor_id, p_service_day, _rows_updated, 
        EXTRACT(EPOCH FROM (now() - _start_time)) * 1000;

      -- Prepare result
      _end_time := now();
      _result := jsonb_build_object(
        'success', true,
        'clinic_doctor_id', p_clinic_doctor_id,
        'service_day', p_service_day,
        'appointments_updated', _rows_updated,
        'processing_time_ms', EXTRACT(EPOCH FROM (_end_time - _start_time)) * 1000,
        'timestamp', _end_time
      );

      RETURN _result;

    EXCEPTION 
      WHEN serialization_failure THEN
        -- Retry on serialization failure (concurrent updates)
        _retry := _retry + 1;
        IF _retry <= _max_retries THEN
          RAISE LOG 'QUEUE_RECALC_RETRY: doctor_id=%, service_day=%, retry=%/%, timestamp=%', 
            p_clinic_doctor_id, p_service_day, _retry, _max_retries, NOW();
          
          -- Wait a bit before retry (exponential backoff)
          PERFORM pg_sleep(0.1 * _retry);
        ELSE
          -- Max retries exceeded
          RAISE LOG 'QUEUE_RECALC_FAILED: doctor_id=%, service_day=%, max_retries_exceeded=%, timestamp=%', 
            p_clinic_doctor_id, p_service_day, _max_retries, NOW();
          RAISE EXCEPTION 'Queue recalculation failed after % retries for doctor % on %', 
            _max_retries, p_clinic_doctor_id, p_service_day;
        END IF;
        
      WHEN OTHERS THEN
        -- Log and re-raise other errors
        RAISE LOG 'QUEUE_RECALC_ERROR: doctor_id=%, service_day=%, error=%, timestamp=%', 
          p_clinic_doctor_id, p_service_day, SQLERRM, NOW();
        RAISE EXCEPTION 'Queue recalculation error for doctor % on %: %', 
          p_clinic_doctor_id, p_service_day, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION recalculate_queue_tx IS 'Transactionally recalculates queue positions for a doctor on a specific day. Handles concurrent updates with retry logic.';

-- Create a helper function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats(p_clinic_doctor_id uuid, p_service_day date)
RETURNS jsonb AS $$
DECLARE
  _day_start timestamp := (p_service_day::timestamp AT TIME ZONE 'UTC');
  _day_end timestamp := _day_start + interval '1 day';
  _stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_appointments', COUNT(*),
    'active_appointments', COUNT(*) FILTER (WHERE status IN ('scheduled', 'checked_in', 'in_progress')),
    'completed_appointments', COUNT(*) FILTER (WHERE status = 'completed'),
    'cancelled_appointments', COUNT(*) FILTER (WHERE status IN ('cancelled', 'no_show')),
    'emergency_appointments', COUNT(*) FILTER (WHERE emergency_status = true),
    'avg_wait_time_minutes', COALESCE(AVG(
      EXTRACT(EPOCH FROM (estimated_start_time - appointment_datetime)) / 60
    ), 0),
    'total_delay_minutes', COALESCE(SUM(delay_minutes), 0)
  ) INTO _stats
  FROM appointments
  WHERE 
    clinic_doctor_id = p_clinic_doctor_id
    AND service_day = p_service_day;

  RETURN _stats;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_queue_stats IS 'Returns queue statistics for a doctor on a specific day.';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_service_day 
ON appointments(clinic_doctor_id, service_day);

CREATE INDEX IF NOT EXISTS idx_appointments_queue_position 
ON appointments(queue_position) WHERE queue_position IS NOT NULL;

-- Additional indexes for queue recalculation performance
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_service_day_status_queue 
ON appointments(clinic_doctor_id, service_day, status, queue_position);

CREATE INDEX IF NOT EXISTS idx_appointments_status_datetime 
ON appointments(status, appointment_datetime) 
WHERE status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS');

-- Index for emergency status ordering
CREATE INDEX IF NOT EXISTS idx_appointments_emergency_status 
ON appointments(emergency_status DESC, appointment_datetime ASC) 
WHERE status IN ('SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS');
