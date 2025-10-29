-- HOTFIX: Correct Status String Format
-- The original migration used underscores but database uses hyphens
-- This fixes: 'checked_in' → 'checked-in', 'in_progress' → 'in-progress', 'no_show' → 'no-show'

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS queue_recalculation_trigger ON appointments;
DROP FUNCTION IF EXISTS trigger_queue_recalculation();
DROP FUNCTION IF EXISTS recalculate_queue_positions(UUID, DATE);

-- CORRECTED Function to recalculate queue positions with HYPHENATED status values
CREATE OR REPLACE FUNCTION recalculate_queue_positions(
  p_clinic_doctor_id UUID,
  p_service_date DATE
) RETURNS JSONB AS $$
DECLARE
  affected_count INTEGER := 0;
BEGIN
  -- Recalculate queue positions based on priority rules:
  -- 1. in-progress (currently consulting) - position 1
  -- 2. checked-in (waiting in clinic) - by check-in time
  -- 3. scheduled (not yet arrived) - by appointment time
  
  WITH numbered_appointments AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN status = 'in-progress' THEN 1  -- FIXED: hyphen not underscore
            WHEN status = 'checked-in' THEN 2   -- FIXED: hyphen not underscore
            WHEN status = 'scheduled' THEN 3
            ELSE 4
          END ASC,
          checked_in_at ASC NULLS LAST,
          appointment_datetime ASC
      ) as new_position
    FROM appointments 
    WHERE clinic_doctor_id = p_clinic_doctor_id 
      AND appointment_datetime::date = p_service_date
      AND status NOT IN ('cancelled', 'no-show', 'completed', 'rescheduled')  -- FIXED: hyphen in no-show
  )
  UPDATE appointments 
  SET 
    queue_position = numbered_appointments.new_position,
    updated_at = NOW()
  FROM numbered_appointments 
  WHERE appointments.id = numbered_appointments.id;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Clear queue position for completed/cancelled appointments
  UPDATE appointments
  SET queue_position = NULL
  WHERE clinic_doctor_id = p_clinic_doctor_id
    AND appointment_datetime::date = p_service_date
    AND status IN ('cancelled', 'no-show', 'completed', 'rescheduled')  -- FIXED: hyphen in no-show
    AND queue_position IS NOT NULL;
  
  RETURN jsonb_build_object(
    'success', true, 
    'recalculated_appointments', affected_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to recalculate queue when appointments change
CREATE OR REPLACE FUNCTION trigger_queue_recalculation()
RETURNS TRIGGER AS $$
DECLARE
  target_doctor_id UUID;
  target_date DATE;
BEGIN
  -- Determine which doctor/date to recalculate
  IF TG_OP = 'DELETE' THEN
    target_doctor_id := OLD.clinic_doctor_id;
    target_date := OLD.appointment_datetime::date;
  ELSE
    target_doctor_id := NEW.clinic_doctor_id;
    target_date := NEW.appointment_datetime::date;
  END IF;
  
  -- Only recalculate if the change affects queue order
  IF TG_OP = 'INSERT' OR 
     TG_OP = 'DELETE' OR
     (TG_OP = 'UPDATE' AND (
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.checked_in_at IS DISTINCT FROM NEW.checked_in_at OR
       OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date OR
       OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id
     )) THEN
    
    -- Recalculate for the target doctor/date
    PERFORM recalculate_queue_positions(target_doctor_id, target_date);
    
    -- If doctor or date changed in UPDATE, also recalculate old doctor/date
    IF TG_OP = 'UPDATE' AND (
      OLD.clinic_doctor_id IS DISTINCT FROM NEW.clinic_doctor_id OR
      OLD.appointment_datetime::date IS DISTINCT FROM NEW.appointment_datetime::date
    ) THEN
      PERFORM recalculate_queue_positions(OLD.clinic_doctor_id, OLD.appointment_datetime::date);
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

-- Recreate trigger
CREATE TRIGGER queue_recalculation_trigger
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_queue_recalculation();

-- Grant permissions
GRANT EXECUTE ON FUNCTION recalculate_queue_positions TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_queue_recalculation TO authenticated;

-- Manually recalculate queue positions for all active appointments
DO $$
DECLARE
  doc_date_record RECORD;
BEGIN
  FOR doc_date_record IN
    SELECT DISTINCT 
      clinic_doctor_id, 
      appointment_datetime::date as service_date
    FROM appointments
    WHERE status NOT IN ('cancelled', 'no-show', 'completed', 'rescheduled')
      AND appointment_datetime >= CURRENT_DATE - INTERVAL '1 day'
  LOOP
    PERFORM recalculate_queue_positions(
      doc_date_record.clinic_doctor_id, 
      doc_date_record.service_date
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION recalculate_queue_positions IS 'Recalculates queue positions with CORRECT hyphenated status values: in-progress, checked-in, no-show';
